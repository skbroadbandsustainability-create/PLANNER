// 코트/캔버스 레이아웃 상수 (내부 해상도 기준, CSS에서 비율 유지하며 스케일링됨)

export const CANVAS_W = 960
export const CANVAS_H = 620

// 코트 라인 (사이드라인/베이스라인)
export const COURT_LEFT = 140
export const COURT_RIGHT = 820
export const COURT_TOP = 110
export const COURT_BOTTOM = 560
export const NET_Y = (COURT_TOP + COURT_BOTTOM) / 2

// 투명 벽: 사이드라인보다 바깥쪽에 있어서 공이 넓게 나가도 벽에 튕겨 돌아온다
export const WALL_LEFT = COURT_LEFT - 60
export const WALL_RIGHT = COURT_RIGHT + 60

// 각 선수가 이동할 수 있는 y범위 (자기 진영 안쪽)
export const PLAYER_MIN_Y = NET_Y + 18
export const PLAYER_MAX_Y = COURT_BOTTOM - 6
export const AI_MIN_Y = COURT_TOP + 6
export const AI_MAX_Y = NET_Y - 18

export const CHAR_MIN_X = WALL_LEFT + 20
export const CHAR_MAX_X = WALL_RIGHT - 20

export const BALL_RADIUS = 9
export const HIT_REACH = 46
export const OUT_MARGIN = 55

export const POINTS_TO_WIN = 4
