import { createGame } from "./game-engine.js";

export function createRoom({ roomId, trainerNames, pokemonCards = [], rarePokemonCards = [], legendaryPokemonCards = [] }) {
  return {
    id: roomId,
    seats: trainerNames.map((name, trainerIndex) => ({
      id: `seat-${trainerIndex + 1}`,
      trainerIndex,
      name,
    })),
    game: createGame({ trainerNames, pokemonCards, rarePokemonCards, legendaryPokemonCards }),
  };
}

export function serializeRoom(room) {
  return JSON.stringify(room);
}

export function deserializeRoom(serializedRoom) {
  return JSON.parse(serializedRoom);
}

export function getPlayerView(room, viewerTrainerIndex) {
  if (!room.seats.some((seat) => seat.trainerIndex === viewerTrainerIndex)) {
    throw new Error("未知训练家座位");
  }

  const view = structuredClone(room);
  view.viewerTrainerIndex = viewerTrainerIndex;
  view.game.viewerTrainerIndex = viewerTrainerIndex;
  view.game.trainers = view.game.trainers.map((trainer, index) => {
    if (index === viewerTrainerIndex) {
      return {
        ...trainer,
        reservedCount: trainer.reserved.length,
      };
    }
    const { reserved, ...publicTrainer } = trainer;
    return {
      ...publicTrainer,
      reservedCount: reserved.length,
    };
  });
  return view.game;
}
