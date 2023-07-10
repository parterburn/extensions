import { List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";

import { PageListItem } from "./components";
import { useRecentPages, useUsers } from "./hooks";
import { search } from "./utils/notion";

export default function SearchList(): JSX.Element {
  const { data: recentPages, setRecentPage } = useRecentPages();
  const [searchText, setSearchText] = useState<string>("");
  const {
    data: searchPages,
    isLoading,
    mutate,
  } = useCachedPromise((searchText) => search(searchText), [searchText], {
    keepPreviousData: true,
  });
  const { data: users } = useUsers();

  const sections = [
    { title: "Recent", pages: recentPages ?? [] },
    { title: "Search", pages: searchPages ?? [] },
  ];

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search pages"
      onSearchTextChange={setSearchText}
      throttle
      filtering
    >
      {sections.map((section) => {
        return (
          <List.Section title={section.title} key={section.title}>
            {section.pages.map((p) => {
              return (
                <PageListItem
                  key={`${section.title}-${p.id}`}
                  page={p}
                  users={users}
                  mutate={mutate}
                  setRecentPage={setRecentPage}
                />
              );
            })}
          </List.Section>
        );
      })}

      <List.EmptyView title="No pages found" />
    </List>
  );
}
