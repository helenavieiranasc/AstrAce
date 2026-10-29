"""Painel de administração (Pessoa 5): eventos, vagas, moderação e destaques da semana."""
import click
from flask import Blueprint
from flask.cli import with_appcontext

from ..extensoes import db

bp = Blueprint("admin", __name__)

from . import routes  # noqa: E402,F401


@click.command("tornar-admin")
@click.argument("email")
@click.option("--remover", is_flag=True, help="Tira o acesso ao painel (volta a ser usuária comum).")
@with_appcontext
def tornar_admin(email, remover):
    """Dá (ou tira) o acesso ao painel: flask --app run tornar-admin pessoa@exemplo.com

    A pessoa precisa ter entrado no site pelo menos uma vez.
    """
    from ..usuarias.models import Usuaria

    usuaria = Usuaria.query.filter(db.func.lower(Usuaria.email) == email.strip().lower()).first()
    if not usuaria:
        raise click.ClickException(f"Ninguém entrou no site com {email}. Peça para ela entrar uma vez e rode de novo.")
    usuaria.papel = "usuaria" if remover else "admin"
    db.session.commit()
    if remover and usuaria.admin_pelo_env:
        click.echo(f"{usuaria.nome} continua no painel: o e-mail está em ADMIN_EMAILS. Tire de lá também.")
    elif remover:
        click.echo(f"{usuaria.nome} não acessa mais o painel.")
    else:
        click.echo(f"{usuaria.nome} agora acessa o painel em /admin.")
