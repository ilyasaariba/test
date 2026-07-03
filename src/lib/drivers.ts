// Constant list of drivers / chauffeurs the warehouse hands gear off to.
// These people have no accounts and nobody edits this list in-app — it's fixed
// and will be replaced with the real roster when the project is handed over.
// (Sample data for now.)
export const DRIVERS = [
  "Mustapha Alaoui",
  "Rachid Benjelloun",
  "Hamid Ouazzani",
  "Youssef Tahiri",
  "Abdellah Saidi",
] as const;

export function isKnownDriver(name: string): boolean {
  return (DRIVERS as readonly string[]).includes(name);
}
