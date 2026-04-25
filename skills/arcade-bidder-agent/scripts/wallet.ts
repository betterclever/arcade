import { main } from "../../../packages/arcad-cli/src/index";

await main(["wallet", ...process.argv.slice(2)]);
