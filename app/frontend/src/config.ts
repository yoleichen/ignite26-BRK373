const dataSource = import.meta.env.VITE_DATA_SOURCE ?? "sample";
if (dataSource !== "sample" && dataSource !== "dab") {
	throw new Error("VITE_DATA_SOURCE must be sample or dab. Check app/frontend/.env.local.");
}

export const DATA_SOURCE: "sample" | "dab" = dataSource;
