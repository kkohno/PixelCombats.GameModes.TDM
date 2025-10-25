// предполагается как общая библиотека, для создания и работы со стандартными командами в режимах (синие, красные, зомби)
// предложения и пул реквесты по улучшению библиотеки приветствуются
// дублируйте мне в вк/тг я тнт.чел котрый общался с вами .и еше дополнение в gamemode.js делаю
import { Color } from 'pixel_combats/basic';
import { Teams } from 'pixel_combats/room';

function create_new_team(TeamName, TeamDisplayName, TeamColor, TeamSpawnPointGroup, TeamBuildBlocksSet) {
 Teams.Add(TeamName, TeamDisplayName, TeamColor);
let NewTeam = Teams.Get(TeamName);
 NewTeam.Spawns.SpawnPointsGroups.Add(TeamSpawnPointGroup);
 NewTeam.Build.BlocksSet.Value = TeamBuildBlocksSet;
return NewTeam;
}
