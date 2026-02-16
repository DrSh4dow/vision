import { loadBuiltInPlugins } from "@vision/runtime";
import { useEffect, useState } from "react";

export function App() {
	const [pluginCount, setPluginCount] = useState<number | null>(null);

	useEffect(() => {
		void loadBuiltInPlugins().then((plugins) => {
			setPluginCount(plugins.length);
		});
	}, []);

	return (
		<main>
			<h1>Vision</h1>
			<p>Embroidery editor scaffold is ready.</p>
			<p>
				Built-in plugins loaded:{" "}
				{pluginCount === null ? "loading..." : pluginCount}
			</p>
		</main>
	);
}
