import { z } from "zod";
import { ApplicationError } from "../errors/application-error";
import { acceptSchema, offerSchema, paymentSchema, requestSchema, type AcceptCommand, type CommercialActor, type CommercialState, type OfferCommand, type PaymentCommand, type RequestCommand, type RequestDto } from "./contracts";

export function commercialError(code:string,category:"FORBIDDEN"|"CONFLICT"|"INVALID_STATE"="CONFLICT") {
  return new ApplicationError(category,code,"Commercial operation could not be completed.",false);
}
export function paymentAllowed(kind:PaymentCommand["kind"],canonicalOrigin:string|undefined,runtimeEnvironment:string|undefined) {
  return kind==="BANK_TRANSFER" || (runtimeEnvironment==="staging" && canonicalOrigin==="https://staging.passvero.eu");
}
export interface CommercialPersistence {
  authorize(actor:CommercialActor):Promise<boolean>;
  state(actor:CommercialActor,organizationId:string,operator:boolean):Promise<CommercialState>;
  list(actor:CommercialActor):Promise<RequestDto[]>;
  request(actor:CommercialActor,organizationId:string,input:RequestCommand):Promise<CommercialState>;
  accept(actor:CommercialActor,organizationId:string,input:AcceptCommand):Promise<CommercialState>;
  offer(actor:CommercialActor,input:OfferCommand):Promise<CommercialState>;
  pay(actor:CommercialActor,input:PaymentCommand):Promise<CommercialState>;
}
export function createCommercialServices(deps:{resolveActor(headers:Headers):Promise<CommercialActor>;resolveOrganization(headers:Headers):Promise<string>;persistence:CommercialPersistence}) {
  const p=deps.persistence;
  function parse<T>(schema:z.ZodType<T>,input:unknown):T { const result=schema.safeParse(input);if(!result.success)throw new ApplicationError("VALIDATION","VALIDATION_ERROR","Invalid commercial input.",false);return result.data; }
  async function tenant(headers:Headers){const actor=await deps.resolveActor(headers);return {actor,organizationId:await deps.resolveOrganization(headers)};}
  async function requireBillingAccess(headers:Headers){const actor=await deps.resolveActor(headers);if(!await p.authorize(actor))throw commercialError("COMMERCIAL_FORBIDDEN","FORBIDDEN");return actor;}
  return {
    requireBillingAccess,
    async tenantState(headers:Headers){const {actor,organizationId}=await tenant(headers);return p.state(actor,organizationId,false);},
    async operatorState(headers:Headers,organizationId:unknown){return p.state(await requireBillingAccess(headers),parse(z.uuid(),organizationId),true);},
    async listRequests(headers:Headers){return p.list(await requireBillingAccess(headers));},
    async request(headers:Headers,input:unknown){const {actor,organizationId}=await tenant(headers);return p.request(actor,organizationId,parse(requestSchema,input));},
    async accept(headers:Headers,input:unknown){const {actor,organizationId}=await tenant(headers);return p.accept(actor,organizationId,parse(acceptSchema,input));},
    async recordOffer(headers:Headers,input:unknown){return p.offer(await requireBillingAccess(headers),parse(offerSchema,input));},
    async confirmPayment(headers:Headers,input:unknown){return p.pay(await requireBillingAccess(headers),parse(paymentSchema,input));},
  };
}
