-- O login passa a ser por nome de usuário, não por e-mail. Quem já existe continua entrando com o valor antigo.

alter table admins rename column email to usuario;
alter table admins rename constraint admins_email_key to admins_usuario_key;
