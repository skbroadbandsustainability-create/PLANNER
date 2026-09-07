// 3D 월드 좌표계 상수 (X=좌우, Y=높이, Z=깊이/코트 길이 방향)
// Three.js의 Y-up 컨벤션을 그대로 따른다.

// 코트 폭(좌우)을 예전 버전보다 좁게 잡아서 실제 테니스 코트에 더 가까운 비율로 만들었다.
export const COURT_HALF_WIDTH = 3.4
export const COURT_HALF_DEPTH = 6.4
export const NET_Z = 0

// 투명 벽: 사이드라인보다 바깥쪽에 있어서 공이 넓게 나가도 벽에 튕겨 돌아온다
export const WALL_MARGIN = 1.4
export const WALL_X = COURT_HALF_WIDTH + WALL_MARGIN

// 각 선수가 이동할 수 있는 z범위 (자기 진영 안쪽)
export const PLAYER_MIN_Z = 0.7
export const PLAYER_MAX_Z = COURT_HALF_DEPTH - 0.3
export const AI_MIN_Z = -(COURT_HALF_DEPTH - 0.3)
export const AI_MAX_Z = -0.7

export const CHAR_MIN_X = -(WALL_X - 0.3)
export const CHAR_MAX_X = WALL_X - 0.3

export const GROUND_Y = 0
export const BALL_RADIUS = 0.14
export const HIT_REACH = 1.5
export const OUT_MARGIN = 1.6
export const BALL_PEAK_HEIGHT = 1.9

export const POINTS_TO_WIN = 4
