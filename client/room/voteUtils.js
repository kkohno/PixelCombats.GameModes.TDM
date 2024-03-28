import { NewGame, NewGameVote } from 'pixel_combats/room'

// Библиотека для старта голосования за новую карту
// Можно вшить в свой режим

export function StartVote(time) {
  NewGameVote.OnResult.Add(OnVoteResult);
  
  NewGameVote.Start({
    Variants: [],
    Timer: 15,
  }, time);
}

function OnVoteResult(vote) {
  if (vote.Result === null) return;
  NewGame.RestartGame(vote.Result)
}