import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { ShowcaseApp } from "./showcase-app";

document.documentElement.classList.add("dark");

createRoot(document.getElementById("root") as HTMLDivElement).render(
	<StrictMode>
		<ShowcaseApp />
	</StrictMode>,
);
