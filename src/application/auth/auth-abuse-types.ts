export const authAbuseEndpoints = [
  "SIGN_IN",
  "ACTIVATE_ACCOUNT",
  "EMAIL_VERIFICATION_REQUEST",
  "EMAIL_VERIFICATION_CONSUME",
  "PASSWORD_RESET_REQUEST",
  "PASSWORD_RESET_CONSUME",
  "PASSWORD_CHANGE",
] as const;

export type AuthAbuseEndpoint = typeof authAbuseEndpoints[number];

export const authAbuseDimensions = [
  "GLOBAL_ENDPOINT",
  "TRUSTED_NETWORK",
  "ACCOUNT_IDENTIFIER",
  "ACCOUNT_AND_TRUSTED_NETWORK",
] as const;

export type AuthAbuseDimension = typeof authAbuseDimensions[number];

export type AuthAbuseBucketKey = Readonly<{
  dimension: AuthAbuseDimension;
  endpoint: AuthAbuseEndpoint;
  keyDigest: string;
}>;
