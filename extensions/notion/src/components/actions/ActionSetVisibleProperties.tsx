import { ActionPanel, Color, Action } from "@raycast/api";

import { DatabaseProperty } from "../../utils/types";

export function ActionSetVisibleProperties(props: {
  databaseProperties: DatabaseProperty[];
  selectedPropertiesIds?: string[];
  onSelect: (propertyId: string) => void;
  onUnselect: (propertyId: string) => void;
}): JSX.Element {
  const { databaseProperties, onSelect, onUnselect, selectedPropertiesIds = [] } = props;

  const selectedProperties = selectedPropertiesIds.map((id) => databaseProperties.find((dp) => dp.id === id));
  const unselectedProperties = databaseProperties.filter((dp) => !selectedPropertiesIds.includes(dp.id));

  return (
    <ActionPanel.Submenu title="Show/Hide Properties" icon="./icon/shown.png">
      <ActionPanel.Section>
        {selectedProperties.map(
          (property) =>
            property && (
              <Action
                key={`selected-property-${property.id}`}
                icon={{ source: `./icon/${property.type}.png`, tintColor: Color.PrimaryText }}
                title={`${property.name}  ✓`}
                onAction={() => onUnselect(property.id)}
              />
            ),
        )}
      </ActionPanel.Section>
      <ActionPanel.Section>
        {unselectedProperties.map((dp) => (
          <Action
            key={`unselected-property-${dp.id}`}
            icon={{ source: `./icon/${dp.type}_secondary.png`, tintColor: Color.SecondaryText }}
            title={dp.name}
            onAction={() => onSelect(dp.id)}
          />
        ))}
      </ActionPanel.Section>
    </ActionPanel.Submenu>
  );
}
