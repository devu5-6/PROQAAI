import type { Preview } from "@storybook/react";
import "../src/styles/global.css";
import "../src/components/button.css";

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { config: {}, options: {} },
    backgrounds: { disable: true },
  },
  decorators: [
    (Story) => (
      <div style={{ padding: 16 }}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
