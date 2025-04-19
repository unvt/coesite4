-- セッション管理用テーブルの作成
CREATE TABLE IF NOT EXISTS `sessions` (
  `session_id` varchar(128) COLLATE utf8mb4_bin NOT NULL,
  `expires` int(11) unsigned NOT NULL,
  `data` mediumtext COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- ユーザー認証プラグインを明示的に指定してユーザーを再作成
ALTER USER 'coesite_user'@'%' IDENTIFIED WITH mysql_native_password BY 'password';
FLUSH PRIVILEGES;