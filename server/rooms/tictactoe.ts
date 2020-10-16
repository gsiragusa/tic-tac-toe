import { Room, Delayed, Client } from 'colyseus';
import { type, Schema, MapSchema, ArraySchema } from '@colyseus/schema';
import FaceitMatch from "./faceitmatch";

// ---------- FACEIT import ----------
import { sendMatchReady, sendMatchStarted, sendMatchFinished } from "nodejs-server-plugin";

const TURN_TIMEOUT = 10
const BOARD_WIDTH = 3;

class State extends Schema {
  @type("string") currentTurn: string;
  @type({ map: "string" }) players = new MapSchema<boolean>();
  @type(["number"]) board: number[] = new ArraySchema<number>(0, 0, 0, 0, 0, 0, 0, 0, 0);
  @type("string") winner: string;
  @type("boolean") draw: boolean;
}

export class TicTacToe extends Room<State> {
  maxClients = 2;
  randomMoveTimeout: Delayed;

  onCreate () {
    this.setState(new State());
    this.onMessage("action", (client, message) => this.playerAction(client, message));

    // ---------- FACEIT Match Ready ----------
    if (faceitMatch.getMatchId() !== "") {
      sendMatchReady(faceitMatch.getMatchId(), {});
    }
  }

  onJoin (client: Client) {
    // bind faceit player ids to session ids
    if (Object.keys(this.state.players).length > 0) {
      this.state.players[client.sessionId] = faceitMatch.getPlayer2();
    } else {
      this.state.players[client.sessionId] = faceitMatch.getPlayer1();
    }

    if (Object.keys(this.state.players).length === 2) {
      this.state.currentTurn = client.sessionId;
      this.setAutoMoveTimeout();

      // lock this room for new users
      this.lock();

      // ---------- FACEIT Match Started ----------
      if (faceitMatch.getMatchId() !== "") {
        sendMatchStarted(faceitMatch.getMatchId(), {});
      }
    }
  }

  playerAction (client: Client, data: any) {
    if (this.state.winner || this.state.draw) {
      return false;
    }

    if (client.sessionId === this.state.currentTurn) {
      const playerIds = Object.keys(this.state.players);

      const index = data.x + BOARD_WIDTH * data.y;

      if (this.state.board[index] === 0) {
        const move = (client.sessionId === playerIds[0]) ? 1 : 2;
        this.state.board[index] = move;

        if (this.checkWin(data.x, data.y, move)) {
          this.state.winner = client.sessionId;

          // ---------- FACEIT Match Finished ----------
          if (faceitMatch.getMatchId() !== "") {
            const winnerId = this.state.players[this.state.winner];
            const faction1Score = winnerId === faceitMatch.getPlayer1() ? 1 : 0;
            const faction2Score = winnerId === faceitMatch.getPlayer2() ? 1 : 0;
            const payload = {
              "score": {
                "faction1": faction1Score,
                "faction2": faction2Score
              }
            }
            sendMatchFinished(faceitMatch.getMatchId(), payload);
          }
        } else if (this.checkBoardComplete()) {
          this.state.draw = true;

          // ---------- FACEIT Match Finished ----------
          if (faceitMatch.getMatchId() !== "") {
            const payload = {
              "score": {
                "faction1": 1, // draws not supported
                "faction2": 0
              }
            }
            sendMatchFinished(faceitMatch.getMatchId(), payload);
          }
        } else {
          // switch turn
          const otherPlayerSessionId = (client.sessionId === playerIds[0]) ? playerIds[1] : playerIds[0];

          this.state.currentTurn = otherPlayerSessionId;

          this.setAutoMoveTimeout();
        }

      }
    }
  }

  setAutoMoveTimeout() {
    if (this.randomMoveTimeout) {
      this.randomMoveTimeout.clear();
    }

    this.randomMoveTimeout = this.clock.setTimeout(() => this.doRandomMove(), TURN_TIMEOUT * 1000);
  }

  checkBoardComplete () {
    return this.state.board
      .filter(item => item === 0)
      .length === 0;
  }

  doRandomMove () {
    const sessionId = this.state.currentTurn;
    for (let x=0; x<BOARD_WIDTH; x++) {
      for (let y=0; y<BOARD_WIDTH; y++) {
        const index = x + BOARD_WIDTH * y;
        if (this.state.board[index] === 0) {
          this.playerAction({ sessionId } as Client, { x, y });
          return;
        }
      }
    }
  }

  checkWin (x, y, move) {
    let won = false;
    let board = this.state.board;

    // horizontal
    for(let y = 0; y < BOARD_WIDTH; y++){
      const i = x + BOARD_WIDTH * y;
      if (board[i] !== move) { break; }
      if (y == BOARD_WIDTH-1) {
        won = true;
      }
    }

    // vertical
    for(let x = 0; x < BOARD_WIDTH; x++){
      const i = x + BOARD_WIDTH * y;
      if (board[i] !== move) { break; }
      if (x == BOARD_WIDTH-1) {
        won = true;
      }
    }

    // cross forward
    if(x === y) {
      for(let xy = 0; xy < BOARD_WIDTH; xy++){
        const i = xy + BOARD_WIDTH * xy;
        if(board[i] !== move) { break; }
        if(xy == BOARD_WIDTH-1) {
          won = true;
        }
      }
    }

    // cross backward
    for(let x = 0;x<BOARD_WIDTH; x++){
      const y =(BOARD_WIDTH-1)-x;
      const i = x + BOARD_WIDTH * y;
      if(board[i] !== move) { break; }
      if(x == BOARD_WIDTH-1){
        won = true;
      }
    }

    return won;
  }

  onLeave (client) {
    delete this.state.players[ client.sessionId ];

    if (this.randomMoveTimeout) this.randomMoveTimeout.clear()

    let remainingPlayerIds = Object.keys(this.state.players)
    if (remainingPlayerIds.length > 0 && !Boolean(this.state.winner)) {
      this.state.winner = remainingPlayerIds[0]

      // ---------- FACEIT Match Finished ----------
      const winnerId = this.state.players[this.state.winner];
      const faction1Score = winnerId === faceitMatch.getPlayer1() ? 1 : 0;
      const faction2Score = winnerId === faceitMatch.getPlayer2() ? 1 : 0;
      const payload = {
        "score": {
          "faction1": faction1Score,
          "faction2": faction2Score
        }
      }
      sendMatchFinished(faceitMatch.getMatchId(), payload);
    }

  }

}

// FACEIT Match
const faceitMatch = new FaceitMatch();

export function getFaceitMatch(): FaceitMatch {
  return faceitMatch;
}

export function createFaceitMatch(matchId: string, fp1: string, fp2: string) {
  faceitMatch.setMatchId(matchId);
  faceitMatch.setPlayer1(fp1);
  faceitMatch.setPlayer2(fp2);
}

export function cancelFaceitMatch() {
  faceitMatch.setMatchId("");
  faceitMatch.setPlayer1("");
  faceitMatch.setPlayer2("");
}