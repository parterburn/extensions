import { List } from "@raycast/api";

import { useComments } from "../hooks";
import { Page } from "../utils/types";

// TODO: Integrate Notion capabilities
export default function PageComments({ page }: { page: Page }) {
  const { data } = useComments(page.id);
  return (
    <List>
      {data?.results.map((comment) => {
        return <List.Item title={comment.created_by.id} />;
      })}
    </List>
  );
}
