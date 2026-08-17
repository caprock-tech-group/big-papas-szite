import { createResultMetadata } from "../result-metadata";
import { TaterResultPage } from "../result-page";

export const metadata = createResultMetadata("taco-tater");
export default function Page() { return <TaterResultPage slug="taco-tater" />; }

