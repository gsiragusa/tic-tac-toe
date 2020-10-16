export default class FaceitMatch {
  getMatchId(): string {
    return this.#_matchid;
  }

  setMatchId(value: string) {
    this.#_matchid = value;
  }

  getPlayer1(): string {
    return this.#_player1;
  }

  setPlayer1(value: string) {
    this.#_player1 = value;
  }

  getPlayer2(): string {
    return this.#_player2;
  }

  setPlayer2(value: string) {
    this.#_player2 = value;
  }
  #_matchid = "";
  #_player1 = "";
  #_player2 = "";
}