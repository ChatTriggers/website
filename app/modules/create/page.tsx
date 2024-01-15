import { getTags } from "db/utils/modules";

import CreateModuleComponent from "./CreateModuleComponent";

export default async function Page() {
  const tags = await getTags();
  return <CreateModuleComponent availableTags={[...tags]} />;
}
