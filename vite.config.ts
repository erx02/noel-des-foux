import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => {
  const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
  const isUserOrOrganizationPage = repositoryName?.endsWith(".github.io") ?? false;
  const base =
    process.env.GITHUB_ACTIONS === "true" &&
    repositoryName &&
    !isUserOrOrganizationPage
      ? `/${repositoryName}/`
      : "/";

  return {
    plugins: [
      react(),
      {
        name: "disable-production-csp-in-dev",
        transformIndexHtml(html: string) {
          return command === "serve"
            ? html.replace(/<meta\s+http-equiv="Content-Security-Policy"[^>]*>/i, "")
            : html;
        },
      },
    ],
    base,
  };
});
