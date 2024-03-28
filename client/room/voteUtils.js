import { NewGame, NewGameVote } from 'pixel_combats/room'

// Библиотека для старта голосования за новую карту
// Можно вшить в свой режим

export function StartVote() {
  NewGameVote.OnData.Add(OnVoteData);
  NewGameVote.OnResult.Add(OnVoteResult);
  
  NewGameVote.Start({
    Variants: [],
    Timer: 15,
  }, 10);
}

function OnVoteResult(vote) {
  if (vote.Result === null) return;
  NewGame.RestartGame(vote.Result)
}