import { Players, LeaderBoard, BuildBlocksSet, Teams, Damage, BreackGraph, Ui, Properties, GameMode, Spawns, Timers, TeamsBalancer } from 'pixel_combats/room';
import * as teams from './default_teams.js';
//var Color = importNamespace('PixelCombats.ScriptingApi.Structures');
//var System = importNamespace('System');

// ���������
var WaitingPlayersTime = 10;
var BuildBaseTime = 30;
var GameModeTime = 600;
var EndOfMatchTime = 10;

// ��������� ����
var WaitingStateValue = "Waiting";
var BuildModeStateValue = "BuildMode";
var GameStateValue = "Game";
var EndOfMatchStateValue = "EndOfMatch";

// ���������� ����������
var mainTimer = Timers.GetContext().Get("Main");
var stateProp = Properties.GetContext().Get("State");

// ��������� ��������� �������� �������
Damage.FriendlyFire = GameMode.Parameters.GetBool("FriendlyFire");
Map.Rotation = GameMode.Parameters.GetBool("MapRotation");
BreackGraph.OnlyPlayerBlocksDmg = GameMode.Parameters.GetBool("PartialDesruction");
BreackGraph.WeakBlocks = GameMode.Parameters.GetBool("LoosenBlocks");

// ���� ������ ������ ������
BreackGraph.PlayerBlockBoost = true;

// ��������� ����
Properties.GetContext().GameModeName.Value = "GameModes/Team Dead Match";
TeamsBalancer.IsAutoBalance = true;
Ui.GetContext().MainTimerId.Value = mainTimer.Id;
// создаем стандартные команды
var blueTeam = teams.create_team_blue();
var redTeam = teams.create_team_red();
blueTeam.Spawns.SpawnPointsGroups.Add(1);
redTeam.Spawns.SpawnPointsGroups.Add(2);
blueTeam.Build.BlocksSet.Value = BuildBlocksSet.Blue;
redTeam.Build.BlocksSet.Value = BuildBlocksSet.Red;

// ������ ���� ������� ������
var maxDeaths = Players.MaxCount * 5;
redTeam.Properties.Get("Deaths").Value = maxDeaths;
blueTeam.Properties.Get("Deaths").Value = maxDeaths;
// ������ ��� �������� � �����������
LeaderBoard.PlayerLeaderBoardValues = [
	{
		Value: "Kills",
		DisplayName: "Statistics/Kills",
		ShortDisplayName: "Statistics/KillsShort"
	},
	{
		Value: "Deaths",
		DisplayName: "Statistics/Deaths",
		ShortDisplayName: "Statistics/DeathsShort"
	},
	{
		Value: "Spawns",
		DisplayName: "Statistics/Spawns",
		ShortDisplayName: "Statistics/SpawnsShort"
	},
	{
		Value: "Scores",
		DisplayName: "Statistics/Scores",
		ShortDisplayName: "Statistics/ScoresShort"
	}
];
LeaderBoard.TeamLeaderBoardValue = {
	Value: "Deaths",
	DisplayName: "Statistics\Deaths",
	ShortDisplayName: "Statistics\Deaths"
};
// ��� ������� � ����������
LeaderBoard.TeamWeightGetter.Set(function (team) {
	return team.Properties.Get("Deaths").Value;
});
// ��� ������ � ����������
LeaderBoard.PlayersWeightGetter.Set(function (player) {
	return player.Properties.Get("Kills").Value;
});

// ������ ��� �������� ������
Ui.GetContext().TeamProp1.Value = { Team: "Blue", Prop: "Deaths" };
Ui.GetContext().TeamProp2.Value = { Team: "Red", Prop: "Deaths" };

// ��������� ���� � ������� �� �������
Teams.OnRequestJoinTeam.Add(function (player, team) { team.Add(player); });
// ����� �� ����� � �������
Teams.OnPlayerChangeTeam.Add(function (player) { player.Spawns.Spawn() });

// ������ ������� ����������� ����� ������
var immortalityTimerName = "immortality";
Spawns.GetContext().OnSpawn.Add(function (player) {
	player.Properties.Immortality.Value = true;
	timer = player.Timers.Get(immortalityTimerName).Restart(5);
});
Timers.OnPlayerTimer.Add(function (timer) {
	if (timer.Id != immortalityTimerName) return;
	timer.Player.Properties.Immortality.Value = false;
});

// ����� ������ ������ ������ �������� ���� ������ � �������
Properties.OnPlayerProperty.Add(function (context, value) {
	if (value.Name !== "Deaths") return;
	if (context.Player.Team == null) return;
	context.Player.Team.Properties.Get("Deaths").Value--;
});
// ���� � ������� ���������� ������� ���������� �� ��������� ����
Properties.OnTeamProperty.Add(function (context, value) {
	if (value.Name !== "Deaths") return;
	if (value.Value <= 0) SetEndOfMatchMode();
});

// ������� �������
Spawns.OnSpawn.Add(function (player) {
	++player.Properties.Spawns.Value;
});
// ������� �������
Damage.OnDeath.Add(function (player) {
	++player.Properties.Deaths.Value;
});
// ������� �������
Damage.OnKill.Add(function (player, killed) {
	if (killed.Team != null && killed.Team != player.Team) {
		++player.Properties.Kills.Value;
		player.Properties.Scores.Value += 100;
	}
});

// ��������� ������������ �������
mainTimer.OnTimer.Add(function () {
	switch (stateProp.Value) {
		case WaitingStateValue:
			SetBuildMode();
			break;
		case BuildModeStateValue:
			SetGameMode();
			break;
		case GameStateValue:
			SetEndOfMatchMode();
			break;
		case EndOfMatchStateValue:
			RestartGame();
			break;
	}
});

// ������ ������ ������� ���������
SetWaitingMode();

// ��������� ����
function SetWaitingMode() {
	stateProp.Value = WaitingStateValue;
	Ui.GetContext().Hint.Value = "Hint/WaitingPlayers";
	Spawns.GetContext().enable = false;
	mainTimer.Restart(WaitingPlayersTime);
}

function SetBuildMode() {
	stateProp.Value = BuildModeStateValue;
	Ui.GetContext().Hint.Value = "Hint/BuildBase";
	var inventory = Inventory.GetContext();
	inventory.Main.Value = false;
	inventory.Secondary.Value = false;
	inventory.Melee.Value = true;
	inventory.Explosive.Value = false;
	inventory.Build.Value = true;

	mainTimer.Restart(BuildBaseTime);
	Spawns.GetContext().enable = true;
	SpawnTeams();
}
function SetGameMode() {
	stateProp.Value = GameStateValue;
	Ui.GetContext().Hint.Value = "Hint/AttackEnemies";

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

	mainTimer.Restart(GameModeTime);
	Spawns.GetContext().Despawn();
	SpawnTeams();
}
function SetEndOfMatchMode() {
	stateProp.Value = EndOfMatchStateValue;
	Ui.GetContext().Hint.Value = "Hint/EndOfMatch";

	var spawns = Spawns.GetContext();
	spawns.enable = false;
	spawns.Despawn();
	Game.GameOver(LeaderBoard.GetTeams());
	mainTimer.Restart(EndOfMatchTime);
}
function RestartGame() {
	Game.RestartGame();
}

function SpawnTeams() {
	var e = Teams.GetEnumerator();
	while (e.moveNext()) {
		Spawns.GetContext(e.Current).Spawn();
	}
}


