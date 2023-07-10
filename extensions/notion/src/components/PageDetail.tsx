import { ActionPanel, Detail, Action, Icon } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useEffect } from "react";

import { fetchPageContent, getPageName } from "../utils/notion";
import { handleOnOpenPage } from "../utils/openPage";
import { Page } from "../utils/types";

import { AppendToPageForm } from "./forms";

export function PageDetail({ page, setRecentPage }: { page: Page; setRecentPage: (page: Page) => Promise<void> }) {
  const pageName = getPageName(page);

  const { data, isLoading, mutate } = useCachedPromise(
    async (id) => {
      const fetchedPageContent = await fetchPageContent(id);

      return fetchedPageContent && fetchedPageContent.markdown ? fetchedPageContent : undefined;
    },
    [page.id],
  );

  useEffect(() => {
    setRecentPage(page);
  }, [page.id]);

  return (
    <Detail
      markdown={`# ${page.title}\n` + (data ? data.markdown : "*Loading...*")}
      isLoading={isLoading}
      navigationTitle={" →  " + pageName}
      actions={
        page.url ? (
          <ActionPanel>
            <ActionPanel.Section title={page.title ? page.title : "Untitled"}>
              <Action
                title="Open in Notion"
                icon={"notion-logo.png"}
                onAction={() => {
                  handleOnOpenPage(page, setRecentPage);
                }}
              />
            </ActionPanel.Section>
            <ActionPanel.Section>
              <Action.Push
                title="Append Content to Page"
                icon={Icon.Plus}
                shortcut={{ modifiers: ["cmd", "shift"], key: "n" }}
                target={<AppendToPageForm page={page} onContentUpdate={mutate} />}
              />
            </ActionPanel.Section>
            <ActionPanel.Section>
              <Action.CopyToClipboard
                title="Copy Page URL"
                content={page.url}
                shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
              />
              <Action.Paste
                title="Paste Page URL"
                content={page.url}
                shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
              />
            </ActionPanel.Section>
          </ActionPanel>
        ) : undefined
      }
    />
  );
}
