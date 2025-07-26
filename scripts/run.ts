import { loadEnvironment } from "rost:core/loaders/environment";
import { loadLocalisations } from "rost:core/loaders/localisations";
import { Client } from "rost/client";

const log = process.env.IS_DEBUG === "true" ? constants.loggers.debug : constants.loggers.standard;

const environment = loadEnvironment({ log });
const localisations = await loadLocalisations({ log });

const client = new Client({ log, environment, localisations });
await client.start();
