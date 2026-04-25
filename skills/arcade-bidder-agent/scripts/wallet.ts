import { main } from "../../../packages/adcade-cli/src/index";

await main(["wallet", ...process.argv.slice(2)]);
