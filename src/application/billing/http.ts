import { ApplicationError } from "../errors/application-error";
import { canonicalProxyDenial,type CanonicalProxyDependencies } from "../http/canonical-proxy";
import type { AuthenticatedUserContextResolution } from "../context/resolve-authenticated-user-context";
import type { createBillingServices } from "./service";
export function createBillingHttpHandler(deps:CanonicalProxyDependencies & {resolveContext(headers:Headers):Promise<AuthenticatedUserContextResolution>;services:ReturnType<typeof createBillingServices>}) {
  const respond=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
  return async (request:Request)=>{
    try {
      const denied=canonicalProxyDenial(request,deps,"FORBIDDEN",request.method==="GET");if(denied)return denied;
      if(new URL(request.url).search)return respond({status:"VALIDATION_ERROR"},400);
      const ctx=await deps.resolveContext(request.headers);
      if(ctx.status!=="RESOLVED")return respond({status:"FORBIDDEN"},403);
      if(request.method==="GET")return respond({profile:await deps.services.get(ctx.context)});
      if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")??""))return respond({status:"VALIDATION_ERROR"},400);
      const reader=request.body?.getReader();if(!reader)return respond({status:"VALIDATION_ERROR"},400);
      let text="",input:unknown;
      const deadline=AbortSignal.timeout(10000),abort=()=>{void reader.cancel().catch(()=>{});};
      deadline.addEventListener("abort",abort,{once:true});
      try {
        const decoder=new TextDecoder("utf-8",{fatal:true});let bytes=0;
        while(true){const part=await reader.read();if(deadline.aborted)throw new Error();if(part.done)break;bytes+=part.value.byteLength;if(bytes>8192)throw new Error();text+=decoder.decode(part.value,{stream:true});}
        input=JSON.parse(text+decoder.decode());
      }catch {await reader.cancel().catch(()=>{});return respond({status:"VALIDATION_ERROR"},400);}
      finally{deadline.removeEventListener("abort",abort);reader.releaseLock();}
      return respond(await deps.services.save(input,ctx.context));
    }catch(error){
      if(error instanceof ApplicationError){const status=error.category==="FORBIDDEN"?403:error.category==="VALIDATION"?400:error.category==="CONFLICT"?409:503;return respond({status:status===503?"OPERATIONAL_FAILURE":error.code},status);}
      return respond({status:"OPERATIONAL_FAILURE"},503);
    }
  };
}
