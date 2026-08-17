import { createResultMetadata } from "../result-metadata";
import { TaterResultPage } from "../result-page";

export const metadata = createResultMetadata("italian-stallion");
export default function Page() { return <TaterResultPage slug="italian-stallion" />; }

