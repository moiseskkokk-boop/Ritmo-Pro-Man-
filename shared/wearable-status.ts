export type WearableState =
  | "connected"
  | "disconnected"
  | "authorization_required"
  | "no_data"
  | "error"
  | "integration_unavailable";
export function wearableState(
  provider: string,
  connection?: { status: string; lastSyncStatus: string } | null,
  hasData?: boolean
): WearableState {
  if (provider === "apple_health" || provider === "health_connect")
    return "integration_unavailable";
  if (!connection || connection.status === "disconnected")
    return "disconnected";
  if (
    connection.status === "authorization_required" ||
    connection.lastSyncStatus === "authorization_required"
  )
    return "authorization_required";
  if (connection.lastSyncStatus === "error") return "error";
  if (
    connection.status === "connected" &&
    connection.lastSyncStatus === "synced" &&
    hasData === false
  )
    return "no_data";
  return connection.status === "connected"
    ? "connected"
    : "authorization_required";
}
export const wearableStateLabels = {
  pt: {
    connected: "CONECTADO",
    disconnected: "DESCONECTADO",
    authorization_required: "AUTORIZAÇÃO NECESSÁRIA",
    no_data: "SEM DADOS",
    error: "ERRO",
    integration_unavailable: "INTEGRAÇÃO INDISPONÍVEL",
  },
  en: {
    connected: "CONNECTED",
    disconnected: "DISCONNECTED",
    authorization_required: "AUTHORIZATION REQUIRED",
    no_data: "NO DATA",
    error: "ERROR",
    integration_unavailable: "INTEGRATION UNAVAILABLE",
  },
  es: {
    connected: "CONECTADO",
    disconnected: "DESCONECTADO",
    authorization_required: "AUTORIZACIÓN NECESARIA",
    no_data: "SIN DATOS",
    error: "ERROR",
    integration_unavailable: "INTEGRACIÓN NO DISPONIBLE",
  },
};
