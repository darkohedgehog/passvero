import hrMessages from "@/messages/hr.json";
import { routing } from "@/src/i18n/routing";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof hrMessages;
  }
}
