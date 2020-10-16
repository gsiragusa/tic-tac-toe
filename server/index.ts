import http from 'http';
import express from 'express';
import cors from "cors";
import { Server } from 'colyseus';
import { TicTacToe, createFaceitMatch, getFaceitMatch } from "./rooms/tictactoe"
// ---------- FACEIT import ----------
import { startServer } from "nodejs-server-plugin";

const app = express();
const port = Number(process.env.PORT || 3553);

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const gameServer = new Server({
  server: server,
  express: app
});

gameServer.define('tictactoe', TicTacToe);
gameServer.listen(port);

// ---------- FACEIT Server startup ----------
startServer(configurationHandler, cancelHandler);

app.use(express.static(__dirname + "/../frontend/public"));
console.log(`Listening on ws://localhost:${ port }`);


// ---------- FACEIT Configuration handler ----------
function configurationHandler(req, res) {

  const matchId = req.body.match_id;
  const fp1 = req.body.factions.faction1.id;
  const fp2 = req.body.factions.faction2.id;
  createFaceitMatch(matchId, fp1, fp2);
}

// ---------- FACEIT Cancel handler ----------
function cancelHandler(req, res) {

  const matchId = req.body.match_id;
  if (matchId !== getFaceitMatch().getMatchId()) {
    return res.status(400).json({
      "status": "ko",
      "error": `match with id ${matchId} is not running!`
    });
  }
  return res.status(200).json({
    "status": "ok"
  });
}