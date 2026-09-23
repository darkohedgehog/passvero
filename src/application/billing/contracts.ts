import { z } from "zod";
// ISO 3166-1 alpha-2, matching the existing uppercase countryCode storage convention.
export const billingCountryCodes = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");
const text = (max: number) => z.string().trim().min(1).max(max).refine(v => !/[\u0000-\u001f\u007f]/.test(v));
export const billingValuesSchema = z.object({
  legalName: text(200), addressLine1: text(200), addressLine2: text(200).nullable(),
  city: text(100), postalCode: text(32).nullable(),
  countryCode: z.string().refine(v => billingCountryCodes.includes(v)),
  billingEmail: z.string().trim().pipe(z.email().max(254)),
  taxIdentifier: text(64).nullable(), vatIdentifier: text(64).nullable(),
}).strict();
export const billingCommandSchema = z.object({expectedRevision:z.number().int().min(0).max(2147483646),values:billingValuesSchema}).strict();
export type BillingValues = z.infer<typeof billingValuesSchema>;
export type BillingCommand = z.infer<typeof billingCommandSchema>;
export type BillingProfile = {revision:number; values:BillingValues};
export const billingSelect = {legalName:true,addressLine1:true,addressLine2:true,city:true,postalCode:true,countryCode:true,billingEmail:true,taxIdentifier:true,vatIdentifier:true} as const;
