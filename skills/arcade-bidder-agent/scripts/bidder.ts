import { main } from "../../../packages/arcad-cli/src/index";

await main(["loop", ...process.argv.slice(2)]);
