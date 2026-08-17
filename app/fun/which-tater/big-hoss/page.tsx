import { createResultMetadata } from "../result-metadata";
import { TaterResultPage } from "../result-page";

export const metadata = createResultMetadata("big-hoss");
export default function Page() { return <TaterResultPage slug="big-hoss" />; }

