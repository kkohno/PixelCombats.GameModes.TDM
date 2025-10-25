import { DisplayValueHeader } from 'pixel_combats/basic';
import { room,Game, Players, Inventory, LeaderBoard, BuildBlocksSet, Teams, Damage, BreackGraph, Ui, Properties, GameMode, Spawns, Timers, TeamsBalancer, NewGame, NewGameVote, MapEditor } from 'pixel_combats/room';
import * as teams from './default_teams.js';
import * as default_timer from './default_timer.js';
import * as damageScores from './damage_scores.js';
import * as mapScores from './map_scores.js';
import { addTeamScores } from './team_scores.js';

room.PopupsEnable = true;
// ето тнт, если чо можешь комм удалить (мои)
// настройки
const WaitingPlayersTime = 10;
const TacticalPreparationTime = 30;
const OvertimeTime = 30;
const OvertimePauseTime = 3;
const MockModeTime = 10;
const EndOfMatchTime = 8;
const VoteTime = 10;

// время основной битвы по размерам карт (согласно ТЗ)
const GAME_MODE_TIMES = {
	'Length_S': 210,  // 3:30
	'Length_M': 270,  // 4:30
	'Length_L': 330,  // 5:30
	'Length_XL': 390  // 6:30
};

// очки
const WINNER_SCORES = 30;  		// очки за победу (новое ТЗ)
const LOSER_SCORES = 15;			// очки за поражение (новое ТЗ)
const TIMER_SCORES = 30;			// очки за проведенное время
const TIMER_SCORES_INTERVAL = 30;	// интервал таймера очков

// имена используемых объектов
const WaitingStateValue = "Waiting";
const TacticalPreparationStateValue = "TacticalPreparation";
const GameStateValue = "Game";
const OvertimeStateValue = "Overtime";        // овертайм - 30 сек решающий бой с бесконечными патронами
const TieBreakerStateValue = "TieBreaker";    // финальный фраг - игра до первого убийства при ничьей
const MockModeStateValue = "MockMode";
const EndOfMatchStateValue = "EndOfMatch";

const immortalityTimerName = "immortality"; // имя таймера, используемого в контексте игрока, для его бессмертия
const KILLS_PROP_NAME = "Kills";
const SCORES_PROP_NAME = "Scores";

// получаем объекты, с которыми работает режим
const mainTimer = Timers.GetContext().Get("Main");
const scores_timer = Timers.GetContext().Get("Scores");
const stateProp = Properties.GetContext().Get("State");

// применяем параметры конструктора режима
Damage.GetContext().FriendlyFire.Value = GameMode.Parameters.GetBool("FriendlyFire");
const MapRotation = GameMode.Parameters.GetBool("MapRotation");
BreackGraph.WeakBlocks = GameMode.Parameters.GetBool("LoosenBlocks");
BreackGraph.OnlyPlayerBlocksDmg = GameMode.Parameters.GetBool("OnlyPlayerBlocksDmg");

// бустим блоки игрока
BreackGraph.PlayerBlockBoost = true;

// имя игрового режима (устарело)
Properties.GetContext().GameModeName.Value = "GameModes/Team Dead Match";
TeamsBalancer.IsAutoBalance = true;
Ui.GetContext().MainTimerId.Value = mainTimer.Id;
// обрабатываем и создаем модульные команды и не 
const redTeam = teams.creare_new_team('Red', 'Teams/Red\nСиние', new Color(125/255, 0, 0, 0), 2, BuildBlocksSet.Red); // модульная команда.если тебе не нравится, можешь удалять ето '\n' это новый текст в js. и еще новый цвет командам.
const blueTeam = teams.create_new_team('Blue', 'Teams/Blue\nКрасные', new Color(0, 0, 125/255, 0), 1, BuildBlocksSet.Blue);

// настраиваем параметры, которые нужно выводить в лидерборде
LeaderBoard.PlayerLeaderBoardValues = [
	new DisplayValueHeader(KILLS_PROP_NAME, "Statistics/Kills", "Statistics/KillsShort"),
	new DisplayValueHeader("Deaths", "Statistics/Deaths", "Statistics/DeathsShort"),
	new DisplayValueHeader("Spawns", "Statistics/Spawns", "Statistics/SpawnsShort"),
	new DisplayValueHeader(SCORES_PROP_NAME, "Statistics/Scores", "Statistics/ScoresShort")
];
LeaderBoard.TeamLeaderBoardValue = new DisplayValueHeader(SCORES_PROP_NAME, "Statistics\\Scores", "Statistics\\Scores");
// задаем сортировку команд для списка лидирующих по командному свойству
LeaderBoard.TeamWeightGetter.Set(function (team) {
	return team.Properties.Get(SCORES_PROP_NAME).Value;
});
// задаем сортировку игроков для списка лидирующих
LeaderBoard.PlayersWeightGetter.Set(function (player) {
	return player.Properties.Get(SCORES_PROP_NAME).Value;
});

// отображаем изначально нули в очках команд
redTeam.Properties.Get(SCORES_PROP_NAME).Value = 0;
blueTeam.Properties.Get(SCORES_PROP_NAME).Value = 0;

// отображаем значения вверху экрана
Ui.GetContext().TeamProp1.Value = { Team: "Blue", Prop: SCORES_PROP_NAME };
Ui.GetContext().TeamProp2.Value = { Team: "Red", Prop: SCORES_PROP_NAME };

// при запросе смены команды игрока - добавляем его в запрашиваемую команду
Teams.OnRequestJoinTeam.Add(function (player, team) { team.Add(player); });
// при запросе спавна игрока - спавним его
Teams.OnPlayerChangeTeam.Add(function (player) { player.Spawns.Spawn() });

// бессмертие после респавна
Spawns.GetContext().OnSpawn.Add(function (player) {
	if (stateProp.Value == MockModeStateValue) {
		player.Properties.Immortality.Value = false;
		return;
	}
	player.Properties.Immortality.Value = true;
	player.Timers.Get(immortalityTimerName).Restart(3);
});
Timers.OnPlayerTimer.Add(function (timer) {
	if (timer.Id != immortalityTimerName) return;
	timer.Player.Properties.Immortality.Value = false;
});

// обработчик спавнов
Spawns.OnSpawn.Add(function (player) {
	if (stateProp.Value == MockModeStateValue) return;
	++player.Properties.Spawns.Value;
});
// обработчик смертей
Damage.OnDeath.Add(function (player) {
	if (stateProp.Value == MockModeStateValue) {
		Spawns.GetContext(player).Spawn();
		return;
	}
	++player.Properties.Deaths.Value;
});

// детальный отчёт по убийству: начисляем очки за убийство и ассисты по ТЗ
Damage.OnKillReport.Add(function (victim, killer, report) {
	if (stateProp.Value == MockModeStateValue) return;
	damageScores.applyKillReportScores(victim, killer, report);
	
	// если это TieBreaker (ничья в овертайме), завершаем игру
	if (stateProp.Value === TieBreakerStateValue) {
		SetEndOfMatch_EndMode();
	}
});

// начисление очков за редактирование карты
MapEditor.OnMapEdited.Add(function (player, details) {
	if (stateProp.Value == MockModeStateValue) return;
	mapScores.applyMapEditScores(player, details, blueTeam, redTeam);
});

// таймер очков за проведенное время (только в основной фазе)
scores_timer.OnTimer.Add(function () {
	if (stateProp.Value !== GameStateValue) return;
	for (const player of Players.All) {
		if (player.Team == null) continue; // если вне команд то не начисляем
		player.Properties.Scores.Value += TIMER_SCORES;
		addTeamScores(player.Team, TIMER_SCORES);
	}
});

// таймер переключения состояний
mainTimer.OnTimer.Add(function () {
	switch (stateProp.Value) {
		case WaitingStateValue:
			SetTacticalPreparation();
			break;
		case TacticalPreparationStateValue:
			SetGameMode();
			break;
		case GameStateValue:
			CheckForOvertime();
			break;
		case OvertimeStateValue:
			// завершаем овертайм
			SetEndOfMatch();
			break;
		case TieBreakerStateValue:
			// TieBreaker завершается только при убийстве
			break;
		case MockModeStateValue:
			SetEndOfMatch_EndMode();
			break;
		case EndOfMatchStateValue:
			start_vote();
			break;
	}
});

// изначально задаем состояние ожидания других игроков
SetWaitingMode();

// состояния игры
function SetWaitingMode() {
	stateProp.Value = WaitingStateValue;
	Ui.GetContext().Hint.Value = "Hint/WaitingPlayers";
	Spawns.GetContext().enable = false;
	mainTimer.Restart(WaitingPlayersTime);
}
function SetTacticalPreparation() {
	stateProp.Value = TacticalPreparationStateValue;
	Ui.GetContext().Hint.Value = "Hint/TacticalPrep";
	var inventory = Inventory.GetContext();
	inventory.Main.Value = false;
	inventory.Secondary.Value = false;
	inventory.Melee.Value = true;
	inventory.Explosive.Value = false;
	inventory.Build.Value = true;
	// урон включен, быстрый респавн
	Damage.GetContext().DamageOut.Value = true;
	Spawns.GetContext().RespawnTime.Value = 2;

	mainTimer.Restart(TacticalPreparationTime);
	Spawns.GetContext().enable = true;
	SpawnTeams();
}
function SetGameMode() {
	// разрешаем нанесение урона
	Damage.GetContext().DamageOut.Value = true;
	stateProp.Value = GameStateValue;
	Ui.GetContext().Hint.Value = "Hint/MainBattle";

	var inventory = Inventory.GetContext();
	if (GameMode.Parameters.GetBool("OnlyKnives")) {
		inventory.Main.Value = false;
		inventory.Secondary.Value = false;
		inventory.Melee.Value = true;
		inventory.Explosive.Value = false;
		inventory.Build.Value = true;
	} else {
		inventory.Main.Value = true;
		inventory.Secondary.Value = true;
		inventory.Melee.Value = true;
		inventory.Explosive.Value = true;
		inventory.Build.Value = true;
	}

	// получаем время основной битвы по размеру карты
	const gameLength = GameMode.Parameters.GetString('GameLength');
	const gameTime = GAME_MODE_TIMES[gameLength] || GAME_MODE_TIMES['Length_M'];
	
	mainTimer.Restart(gameTime);
	Spawns.GetContext().Despawn();
	SpawnTeams();
}
// проверка необходимости овертайма
function CheckForOvertime() {
	scores_timer.Stop(); // выключаем таймер очков
	const leaderboard = LeaderBoard.GetTeams();
	const team1Score = leaderboard[0].Weight;
	const team2Score = leaderboard[1].Weight;
	
	// проверяем условие овертайма: разница команд ≤ 10%
	const maxScore = Math.max(team1Score, team2Score);
	const minScore = Math.min(team1Score, team2Score);
	const difference = maxScore > 0 ? (maxScore - minScore) / maxScore : 0;
	
	if (difference <= 0.1) {
		// запускаем овертайм
		SetOvertime();
	} else {
		// сразу переходим к завершению
		SetEndOfMatch();
	}
}

// функция овертайма
function SetOvertime() {
	stateProp.Value = OvertimeStateValue;
	Ui.GetContext().Hint.Value = "Hint/Overtime";
	
	// включаем бесконечные патроны для всех
	var inventory = Inventory.GetContext();
	inventory.MainInfinity.Value = true;
	inventory.SecondaryInfinity.Value = true;
	inventory.ExplosiveInfinity.Value = true;
	
	// запускаем овертайм на 30 секунд
	mainTimer.Restart(OvertimeTime);
}

function SetEndOfMatch() {
	scores_timer.Stop(); // выключаем таймер очков
	const leaderboard = LeaderBoard.GetTeams();
	if (leaderboard[0].Weight !== leaderboard[1].Weight) {
		// режим прикола вконце катки
		SetMockMode(leaderboard[0].Team, leaderboard[1].Team);
		// добавляем очки победившим
		for (const win_player of leaderboard[0].Team.Players) {
			win_player.Properties.Scores.Value += WINNER_SCORES;
		}
		// добавляем очки проигравшим
		for (const lose_player of leaderboard[1].Team.Players) {
			lose_player.Properties.Scores.Value += LOSER_SCORES;
		}
	}
	else {
		// ничья - играем до первого очка
		if (stateProp.Value === OvertimeStateValue) {
			stateProp.Value = TieBreakerStateValue;
			Ui.GetContext().Hint.Value = "Hint/TieBreaker";
		} else {
			SetEndOfMatch_EndMode();
		}
	}
}
function SetMockMode(winners, loosers) {
	// задаем состояние игры
	stateProp.Value = MockModeStateValue;
	scores_timer.Stop(); // выключаем таймер очков

	// подсказка
	Ui.GetContext(winners).Hint.Value = "Hint/MockHintForWinners";
	Ui.GetContext(loosers).Hint.Value = "Hint/MockHintForLoosers";

	// разрешаем нанесение урона
	Damage.GetContext().DamageOut.Value = true;
	// время спавна
	Spawns.GetContext().RespawnTime.Value = 2;

	// set loosers
	var inventory = Inventory.GetContext(loosers);
	inventory.Main.Value = false;
	inventory.Secondary.Value = false;
	inventory.Melee.Value = false;
	inventory.Explosive.Value = false;
	inventory.Build.Value = false;

	// set winners
	inventory = Inventory.GetContext(winners);
	inventory.MainInfinity.Value = true;
	inventory.SecondaryInfinity.Value = true;
	inventory.ExplosiveInfinity.Value = true;
	inventory.BuildInfinity.Value = true;

	// перезапуск таймера мода
	mainTimer.Restart(MockModeTime);
}
function SetEndOfMatch_EndMode() {
	stateProp.Value = EndOfMatchStateValue;
	scores_timer.Stop(); // выключаем таймер очков
	Ui.GetContext().Hint.Value = "Hint/EndOfMatch";

	var spawns = Spawns.GetContext();
	spawns.enable = false;
	spawns.Despawn();

	Game.GameOver(LeaderBoard.GetTeams());
	mainTimer.Restart(EndOfMatchTime);
}

function OnVoteResult(v) {
	if (v.Result === null) return;
	NewGame.RestartGame(v.Result);
}
NewGameVote.OnResult.Add(OnVoteResult);

function start_vote() {
	NewGameVote.Start({
		Variants: [{ MapId: 0 }],
		Timer: VoteTime
	}, MapRotation ? 3 : 0);
}

function SpawnTeams() {
	for (const team of Teams)
		Spawns.GetContext(team).Spawn();
}

scores_timer.RestartLoop(TIMER_SCORES_INTERVAL);

