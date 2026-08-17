import { createResultMetadata } from "../result-metadata";
import { TaterResultPage } from "../result-page";

export const metadata = createResultMetadata("broccoli-cheddar");
export default function Page() { return <TaterResultPage slug="broccoli-cheddar" />; }

