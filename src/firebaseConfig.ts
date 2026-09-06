// Firebase 프로젝트 설정값.
// Firebase 콘솔(console.firebase.google.com) > 프로젝트 설정 > "내 앱" > 웹 앱 설정에서
// 나오는 firebaseConfig 객체를 그대로 아래에 붙여넣으면 기기 간 실시간 연동이 동작해요.
//
// 참고: 이 값들은 "비밀키"가 아니라 웹 클라이언트에 공개적으로 포함되는 식별 정보예요.
// 실제 접근 제어는 Firebase 콘솔의 Firestore 보안 규칙(rules)으로 합니다.
export const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
}

export const isFirebaseConfigured = firebaseConfig.apiKey !== 'REPLACE_ME'
