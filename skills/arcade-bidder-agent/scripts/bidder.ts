import { main } from "../../../packages/adcade-cli/src/index";

await main(["loop", ...process.argv.slice(2)]);
