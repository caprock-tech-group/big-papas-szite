import { createResultMetadata } from "../result-metadata";
import { TaterResultPage } from "../result-page";

export const metadata = createResultMetadata("chicken-fried-steak");
export default function Page() { return <TaterResultPage slug="chicken-fried-steak" />; }

