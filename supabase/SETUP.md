# Supabase 로그인 연결

Supabase 프로젝트 정보가 비어 있으면 로그인 버튼을 비활성화합니다. 기존 기기 저장, QT와 말씀 읽기는 계속 사용할 수 있습니다. 아래 설정을 마치면 구글 로그인과 계정 동기화가 활성화됩니다.

## 1. 프로젝트 생성

1. [Supabase](https://supabase.com/dashboard)에 가입하고 **New project**를 누릅니다.
2. 프로젝트 이름을 Quolingo 등으로 정하고, 가까운 지역을 선택합니다.
3. 데이터베이스 비밀번호를 설정하고 프로젝트 생성을 기다립니다. 비밀번호는 이 저장소나 채팅에 넣지 않습니다.

## 2. 기록 저장과 접근 규칙 생성

프로젝트의 **SQL Editor → New query**에서 [schema.sql](schema.sql)의 전체 내용을 실행합니다.

- `quolingo_state`에는 사용자별 프로필·QT·말씀 읽기·이전 기록을 저장합니다.
- 인증한 사용자는 자신의 행만 조회합니다.
- 저장 함수가 JWT에서 사용자 ID를 확인하므로 브라우저에서 다른 소유자를 지정할 수 없습니다.
- 버전을 확인하며 저장해 다른 기기의 수정 내용을 무조건 덮어쓰지 않습니다.
- 나중에 친구 기능을 추가하더라도 이 테이블의 개인 묵상을 공개하지 않고, 친구 관계와 공유 범위를 별도로 설계합니다.

## 3. 사이트 주소 등록

Supabase의 **Authentication → URL Configuration**에 다음 주소를 등록합니다.

**Site URL**:

```text
https://sangwoo-a11y.github.io/Quolingo.github.io/
```

**Redirect URLs**에도 같은 주소를 추가합니다. `/Quolingo.github.io/` 경로와 마지막 `/`까지 포함합니다.

로컬 개발용 주소가 필요하면 `http://127.0.0.1:8080/`도 Redirect URLs에 별도로 추가합니다.

## 4. 구글 로그인 연결

1. Supabase의 **Authentication → Sign In / Providers → Google**을 엽니다.
2. 화면에 표시된 **Callback URL**을 복사합니다. 일반적으로 아래 형태입니다.

   ```text
   https://<프로젝트 식별자>.supabase.co/auth/v1/callback
   ```

3. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트와 OAuth 동의 화면을 설정합니다. 로그인에는 기본 프로필·이메일 범위만 필요합니다.
4. OAuth Client ID를 **Web application** 유형으로 생성합니다.
5. **Authorized JavaScript origins**에는 `https://sangwoo-a11y.github.io`를 등록합니다.
6. **Authorized redirect URIs**에는 2번에서 복사한 Supabase Callback URL을 등록합니다. GitHub Pages 주소를 대신 넣지 않습니다.
7. Google Client ID와 Client Secret을 Supabase의 Google Provider 설정에 입력하고 활성화합니다. Client Secret은 Supabase 대시보드에만 입력합니다.
8. 구글 동의 화면이 Testing 상태라면 테스트 사용자에 로그인할 이메일을 등록합니다. 다른 사람에게 공개할 때는 구글 동의 화면의 공개 설정을 확인합니다.

## 5. 공개 연결 정보 입력

프로젝트의 **Connect** 창 또는 **Settings → API Keys / Data API**에서 다음 정보를 확인합니다.

- **Project URL**: `https://<프로젝트 식별자>.supabase.co`
- **Publishable key**: `sb_publishable_...` 형태. 구형 프로젝트의 `anon` 키도 가능합니다.

저장소 루트의 [supabase-config.js](../supabase-config.js)에 입력합니다.

```js
window.QUOLINGO_SUPABASE = {
  url: 'https://<프로젝트 식별자>.supabase.co',
  publishableKey: 'sb_publishable_...'
};
```

이 두 값은 브라우저에서 사용하는 공개 설정입니다. 데이터 보호는 2번 SQL의 접근 규칙으로 적용합니다. **`service_role`, `sb_secret_...`, 데이터베이스 비밀번호, Google Client Secret은 파일에 넣지 않습니다.**

변경 사항을 `main`에 올리면 GitHub Pages가 배포합니다. Project URL과 publishable key만 전달해 연결 작업을 맡길 수도 있습니다.

## 6. 실제 로그인 확인

1. 사이트의 **계정 → 구글로 로그인**을 누릅니다.
2. 로그인한 이메일과 저장 상태를 확인합니다.
3. 로그인 전 기록과 계정 기록이 분리되는지 확인합니다. 로그인 전 기록은 로그아웃하면 다시 볼 수 있습니다.
4. QT를 작성하거나 말씀 읽기를 완료하고, 계정에서 **계정에 저장했어요**를 확인합니다.
5. 다른 브라우저·휴대폰에서 같은 구글 계정으로 로그인해 기록을 확인합니다.
6. 로그아웃 후에는 로그인 전 기기 기록으로 돌아갑니다. 다른 계정의 기록이 섞이지 않습니다.

구글 로그인 후 돌아오지 못하면 3번의 Redirect URLs와 4번의 Callback URL을 확인합니다. 로그인은 되지만 동기화가 실패하면 SQL 실행 여부와 해당 프로젝트의 URL·키가 서로 일치하는지 확인합니다.

## 동기화 동작

- 입력한 내용은 먼저 현재 계정의 기기 저장소에 저장하고, 변경 후 약 0.8초 뒤 계정에 업로드합니다.
- 앱이 보이는 동안 30초 간격, 다시 화면을 열 때, 네트워크가 복구될 때 계정 기록을 다시 확인합니다.
- 연결이 끊겨도 로그인한 계정의 기기 기록은 유지합니다. 연결이 복구되면 자동 재시도합니다. 수동 동기화·기존 기록 가져오기·전체 기록 백업 버튼은 표시하지 않습니다.
- 다른 날짜나 다른 항목의 수정은 합칩니다. 말씀 읽기의 추가·취소도 항목별로 합칩니다.
- 같은 항목을 다르게 수정하면 계정 화면에 두 내용을 표시합니다. 선택한 쪽은 충돌 항목에 적용하고, 나머지 기록은 합쳐 보존합니다. 선택 전 두 내용은 이 계정의 기기에 백업합니다.
- 로그아웃은 현재 기기에서만 수행합니다. 다른 기기 로그인은 유지됩니다.
- 계정 기록의 기기 캐시도 localStorage에 보관합니다. 공용 기기에서 캐시까지 제거하려면 로그아웃 후 브라우저의 사이트 데이터를 삭제합니다.

## 개발 검증

```sh
node --test tests/cloud.test.cjs
node tests/cloud-browser.cjs
```

인증·API 모의 테스트는 실제 구글 로그인이나 외부 묵상 업로드를 수행하지 않습니다.

SQL은 PostgreSQL 엔진으로도 검증할 수 있습니다. `@electric-sql/pglite@0.3.14`를 별도 개발 경로에 설치한 뒤 실행합니다.

```sh
PGLITE_MODULE=/설치경로/node_modules/@electric-sql/pglite node tests/cloud-sql.cjs
```

실제 Google OAuth와 Supabase 연결은 1–5번 설정 후 6번 순서로 확인해야 합니다.
