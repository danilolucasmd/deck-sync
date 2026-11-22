export const routes = {
  provider: "/decksync/provider",
  gamePattern: "/decksync/game/:id",
  game: (id: string) => `/decksync/game/${id}`,
};
