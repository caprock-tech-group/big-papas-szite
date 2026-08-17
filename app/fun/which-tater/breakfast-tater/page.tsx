import { createResultMetadata } from "../result-metadata";
import { TaterResultPage } from "../result-page";

export const metadata = createResultMetadata("breakfast-tater");
export default function Page() { return <TaterResultPage slug="breakfast-tater" />; }

