import { ActionPanel, Icon, List, Action, Image, Color, confirmAlert } from "@raycast/api";
import { format } from "date-fns";

import { deletePage, extractPropertyValue, pageIcon } from "../utils/notion";
import { handleOnOpenPage } from "../utils/openPage";
import { DatabaseView, Page, DatabaseProperty, User } from "../utils/types";

import { DatabaseList } from "./DatabaseList";
import PageComments from "./PageComments";
import { PageDetail } from "./PageDetail";
import { ActionSetVisibleProperties, ActionEditPageProperty } from "./actions";
import ActionCreateQuicklink from "./actions/ActionCreateQuicklink";
import { CreateDatabaseForm, DatabaseViewForm, AppendToPageForm } from "./forms";

type PageListItemProps = {
  keywords?: string[];
  page: Page;
  databaseView?: DatabaseView;
  databaseProperties?: DatabaseProperty[];
  setDatabaseView?: (databaseView: DatabaseView) => Promise<void>;
  setRecentPage: (page: Page) => Promise<void>;
  mutate: () => Promise<void>;
  users?: User[];
  icon?: Image.ImageLike;
  customActions?: JSX.Element[];
};

export function PageListItem({
  page,
  customActions,
  databaseProperties,
  databaseView,
  setRecentPage,
  setDatabaseView,
  icon = pageIcon(page),
  users,
  keywords = [],
  mutate,
}: PageListItemProps) {
  const accessories: List.Item.Accessory[] = [];

  const lastEditedUser = users?.find((u) => u.id === page.last_edited_user);

  if (page.last_edited_time) {
    const date = new Date(page.last_edited_time);
    accessories.push({
      date,
      icon: lastEditedUser?.avatar_url ? { source: lastEditedUser.avatar_url, mask: Image.Mask.Circle } : undefined,
      tooltip: `Last Edited: ${format(date, "EEE d MMM yyyy 'at' HH:mm")}${
        lastEditedUser ? ` by ${lastEditedUser.name}` : ""
      }`,
    });
  }

  if (databaseView && databaseView.properties) {
    const accessoryTitles = Object.keys(databaseView.properties)
      .map((propId) => Object.values(page.properties).find((x) => x.id == propId))
      .map((prop: any | undefined) => (prop ? extractPropertyValue(prop) : undefined))
      .filter((value): value is string => typeof value === "string");

    keywords.push(...accessoryTitles);
    accessories.push(...accessoryTitles.map((text) => ({ text })));
  }

  const quickEditProperties = databaseProperties?.filter((property) =>
    ["checkbox", "select", "multi_select", "people"].includes(property.type),
  );

  const visiblePropertiesIds: string[] =
    databaseProperties?.filter((dp: DatabaseProperty) => databaseView?.properties?.[dp.id]).map((dp) => dp.id) || [];

  return (
    <List.Item
      keywords={keywords}
      title={page.title ? page.title : "Untitled"}
      icon={icon}
      subtitle={page.object === "database" ? "Database" : undefined}
      actions={
        <ActionPanel>
          <ActionPanel.Section title={page.title ? page.title : "Untitled"}>
            {page.object === "database" ? (
              <Action.Push
                title="Navigate to Database"
                icon={Icon.List}
                target={<DatabaseList databasePage={page} setRecentPage={setRecentPage} />}
              />
            ) : (
              <Action.Push
                title="Preview Page"
                icon={Icon.BlankDocument}
                target={<PageDetail page={page} setRecentPage={setRecentPage} />}
              />
            )}
            <Action
              title="Open in Notion"
              icon={"notion-logo.png"}
              onAction={() => handleOnOpenPage(page, setRecentPage)}
            />
            {customActions?.map((action) => action)}
            {databaseProperties ? (
              <ActionPanel.Submenu
                title="Edit Property"
                icon={{ source: "icon/edit_page_property.png", tintColor: Color.PrimaryText }}
                shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
              >
                {quickEditProperties?.map((dp: DatabaseProperty) => (
                  <ActionEditPageProperty
                    key={dp.id}
                    databaseProperty={dp}
                    pageId={page.id}
                    pageProperty={page.properties[dp.id]}
                    mutate={mutate}
                  />
                ))}
              </ActionPanel.Submenu>
            ) : null}
          </ActionPanel.Section>

          <ActionPanel.Section>
            {page.object === "page" ? (
              <Action.Push
                title="Append Content to Page"
                icon={Icon.Plus}
                shortcut={{ modifiers: ["cmd"], key: "n" }}
                target={<AppendToPageForm page={page} />}
              />
            ) : (
              <Action.Push
                title="Create New Page"
                icon={Icon.Plus}
                shortcut={{ modifiers: ["cmd"], key: "n" }}
                target={<CreateDatabaseForm databaseId={page.id} mutate={mutate} />}
              />
            )}

            <ActionCreateQuicklink page={page} />

            <Action.Push
              title="Show Page Comments"
              icon={Icon.SpeechBubble}
              shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
              target={<PageComments page={page} />}
            />

            <Action
              title="Delete Page"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              shortcut={{ modifiers: ["ctrl"], key: "x" }}
              onAction={async () => {
                if (
                  await confirmAlert({
                    title: "Delete Page",
                    icon: Icon.Trash,
                    message:
                      "Do you want to delete this page? Don't worry, you'll be able to restore it from Notion's trash.",
                  })
                ) {
                  await deletePage(page.id);
                  await mutate();
                }
              }}
            />
          </ActionPanel.Section>

          {databaseProperties && setDatabaseView ? (
            <ActionPanel.Section title="View options">
              {page.parent_database_id ? (
                <Action.Push
                  title="Set View Type"
                  icon={databaseView?.type ? `./icon/view_${databaseView.type}.png` : "./icon/view_list.png"}
                  target={
                    <DatabaseViewForm
                      databaseId={page.parent_database_id}
                      databaseView={databaseView}
                      setDatabaseView={setDatabaseView}
                    />
                  }
                />
              ) : null}
              <ActionSetVisibleProperties
                databaseProperties={databaseProperties}
                selectedPropertiesIds={visiblePropertiesIds}
                onSelect={(propertyId: string) => {
                  setDatabaseView({
                    ...databaseView,
                    properties: { ...databaseView?.properties, [propertyId]: {} },
                  });
                }}
                onUnselect={(propertyId: string) => {
                  const { [propertyId]: _, ...remainingProperties } = databaseView?.properties ?? {};

                  setDatabaseView({
                    ...databaseView,
                    properties: remainingProperties,
                  });
                }}
              />
            </ActionPanel.Section>
          ) : null}

          {page.url ? (
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
          ) : null}
        </ActionPanel>
      }
      accessories={accessories}
    />
  );
}
