import secrets
from datetime import date, datetime

from flask import current_app, jsonify, redirect, render_template, request, session, url_for

from .. import catalogos
from ..extensoes import db
from ..uploads.models import Arquivo
from ..usuarias.models import ContaUsuaria, IdentidadeUsuaria, Usuaria
from . import bp, google

# Códigos que voltam para a landing em ?erro=. O texto aparece perto do botão.
ERROS_LOGIN = {
    "nao_configurado": "O login com Google ainda não está disponível. Tente de novo mais tarde.",
    "cancelado": "Você cancelou a entrada com Google. Quando quiser, é só tentar de novo.",
    "estado": "Sua tentativa de entrar expirou. Clique em “Entrar com Google” de novo.",
    "google": "Não conseguimos falar com o Google agora. Tente de novo em instantes.",
    "email": "Sua conta Google precisa ter o e-mail confirmado para entrar.",
}

# Token do QR que a usuária escaneou antes de entrar: depois do login (e do cadastro), a página
# inicial leva de volta ao check-in.
CHECKIN_PENDENTE = "checkin_pendente"


def _erro(mensagem, status, **extra):
    return jsonify({"erro": mensagem, **extra}), status


def _usuaria_logada():
    """Só quem entrou de verdade (sessão). Não usa o atalho LOGIN_DEV de auth.usuaria_atual."""
    uid = session.get("usuaria_id")
    return db.session.get(Usuaria, uid) if uid else None


def _cadastro_completo(usuaria):
    return bool(usuaria.conta and usuaria.conta.cadastro_completo)


def _destino(usuaria):
    """Depois de entrar: a página inicial (o próprio /) ou, se o perfil não está pronto, o cadastro."""
    return url_for("conta.landing") if _cadastro_completo(usuaria) else url_for("conta.pagina_cadastro")


# ---------- Landing e login ----------


@bp.get("/")
def landing():
    """Sem login: a landing. Com o cadastro completo: a página inicial (o mural de navegação)."""
    usuaria = _usuaria_logada()
    if usuaria:
        if not _cadastro_completo(usuaria):
            return redirect(url_for("conta.pagina_cadastro"))
        token = session.pop(CHECKIN_PENDENTE, None)
        if token:
            return redirect(url_for("passaporte.pagina_checkin", token=token))
        return render_template("inicio.html", nome=usuaria.nome_publico)
    codigo = request.args.get("erro")
    return render_template(
        "landing.html",
        erro=ERROS_LOGIN.get(codigo),
        dica_config=codigo == "nao_configurado" and current_app.debug,
    )


@bp.get("/entrar/google")
def entrar_google():
    if not google.configurado():
        current_app.logger.warning("Login com Google sem GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET no .env.")
        return redirect(url_for("conta.landing", erro="nao_configurado"))
    estado = secrets.token_urlsafe(24)
    session["oauth_estado"] = estado
    return redirect(google.url_de_login(estado))


@bp.get("/entrar/google/retorno")
def google_retorno():
    estado_esperado = session.pop("oauth_estado", None)
    if request.args.get("error"):
        return redirect(url_for("conta.landing", erro="cancelado"))
    if not estado_esperado or not secrets.compare_digest(estado_esperado, request.args.get("state", "")):
        return redirect(url_for("conta.landing", erro="estado"))
    codigo = request.args.get("code")
    if not codigo:
        return redirect(url_for("conta.landing", erro="google"))

    try:
        perfil = google.buscar_perfil(google.trocar_codigo(codigo))
    except google.ErroGoogle as erro:
        current_app.logger.warning("Login com Google falhou: %s", erro)
        return redirect(url_for("conta.landing", erro="google"))
    if perfil.get("email_verified") is False:
        return redirect(url_for("conta.landing", erro="email"))

    usuaria = _usuaria_do_google(perfil)
    from ..passaporte.servico import conceder_boas_vindas

    conceder_boas_vindas(usuaria)  # o carimbo de boas-vindas do passaporte (só na primeira vez)
    checkin_pendente = session.get(CHECKIN_PENDENTE)
    session.clear()
    session["usuaria_id"] = usuaria.id
    if checkin_pendente:
        session[CHECKIN_PENDENTE] = checkin_pendente
    session.permanent = True
    return redirect(_destino(usuaria))


def _usuaria_do_google(perfil):
    """Acha a usuária pela conta Google ou pelo e-mail; se não existir, cria."""
    conta = ContaUsuaria.query.filter_by(google_sub=perfil["sub"]).first()
    if conta:
        usuaria = conta.usuaria
    else:
        email = perfil["email"].strip().lower()
        usuaria = Usuaria.query.filter(db.func.lower(Usuaria.email) == email).first()
        if not usuaria:
            usuaria = Usuaria(nome=(perfil.get("name") or email.split("@")[0])[:120], email=email)
            db.session.add(usuaria)
            db.session.flush()
        conta = usuaria.conta or ContaUsuaria(usuaria_id=usuaria.id)
        conta.google_sub = perfil["sub"]
        db.session.add(conta)

    # A foto do Google fica à parte: aparece enquanto a usuária não escolhe uma própria.
    if conta.foto_url and not conta.tem_foto_propria:
        conta.foto_url = None  # contas antigas guardavam a foto do Google aqui
    conta.foto_google_url = (perfil.get("picture") or "")[:500] or None
    conta.ultimo_acesso_em = datetime.utcnow()
    db.session.commit()
    return usuaria


@bp.post("/sair")
def sair():
    session.clear()
    return redirect(url_for("conta.landing"))


# ---------- Cadastro inicial ----------


@bp.get("/cadastro")
def pagina_cadastro():
    if not _usuaria_logada():
        return redirect(url_for("conta.landing"))
    return render_template("cadastro.html", modo="cadastro")


@bp.get("/perfil/editar")
def pagina_editar_perfil():
    """O mesmo formulário do cadastro, com biografia, cancelar e volta para o perfil."""
    usuaria = _usuaria_logada()
    if not usuaria:
        return redirect(url_for("conta.landing"))
    if not _cadastro_completo(usuaria):
        return redirect(url_for("conta.pagina_cadastro"))
    return render_template("cadastro.html", modo="editar")


@bp.app_context_processor
def _conta_no_topo():
    """Foto e nome de quem entrou, para o canto direito do cabeçalho de todas as páginas."""
    usuaria = _usuaria_logada()
    if not usuaria:
        return {"conta_topo": None}
    nome = usuaria.nome_publico or ""
    return {
        "conta_topo": {
            "nome": nome,
            "inicial": nome[:1].upper() or "?",
            "foto_url": usuaria.conta.foto_exibida if usuaria.conta else None,
        }
    }


def _formacoes(usuaria):
    conta = usuaria.conta
    if usuaria.nivel == "ensino_medio":
        return []
    if conta and conta.formacoes is not None:
        return conta.formacoes
    # Perfil de antes das graduações: usa o curso e a instituição que já existiam.
    if usuaria.curso or usuaria.instituicao:
        return [{"curso": usuaria.curso or "", "instituicao": usuaria.instituicao or ""}]
    return []


def _perfil_json(usuaria):
    conta = usuaria.conta
    return {
        "nome": usuaria.nome,
        "apelido": usuaria.apelido or "",
        "email": usuaria.email,
        "foto_url": conta.foto_exibida if conta else None,
        "foto_propria": bool(conta and conta.tem_foto_propria),
        "foto_google_url": conta.foto_google_url if conta else None,
        "bio": usuaria.bio or "",
        "data_nascimento": conta.data_nascimento.isoformat() if conta and conta.data_nascimento else "",
        "nivel": usuaria.nivel or "",
        "area_interesse": usuaria.area_interesse or "",
        "instituicao": usuaria.instituicao or "",
        "formacoes": _formacoes(usuaria),
        "estado": (conta.estado if conta else None) or "",
        "cidade": usuaria.cidade or "",
        "identidades": [{"valor": i.identidade, "publica": i.publica} for i in usuaria.identidades],
        "cadastro_completo": _cadastro_completo(usuaria),
    }


@bp.get("/api/perfil")
def api_perfil():
    usuaria = _usuaria_logada()
    if not usuaria:
        return _erro("Entre com sua conta Google para ver seu perfil.", 401)
    return jsonify({
        "perfil": _perfil_json(usuaria),
        "opcoes": {
            "niveis": catalogos.NIVEIS,
            "areas": catalogos.AREAS,
            "identidades": catalogos.IDENTIDADES,
            "estados": catalogos.ESTADOS,
            "cidades_existentes": _cidades_existentes(),
        },
    })


def _cidades_existentes():
    """Cidades que já aparecem no site (projetos, eventos, vagas e perfis).
    Servem de sugestão quando a lista do IBGE não carrega."""
    from ..eventos.models import Evento
    from ..mural.models import Projeto
    from ..vagas.models import Vaga

    nomes = set()
    for modelo in (Projeto, Evento, Vaga, Usuaria):
        nomes.update(c for (c,) in db.session.query(modelo.cidade).distinct() if c)
    return sorted(nomes)


def _texto(dados, nome, limite):
    valor = dados.get(nome)
    return "" if valor is None else str(valor).strip()[:limite]


def _validar_perfil(dados, usuaria):
    erros, limpo = {}, {}

    apelido = _texto(dados, "apelido", 61)
    if len(apelido) < 2:
        erros["apelido"] = "Escreva como você quer ser chamada (pelo menos 2 letras)."
    elif len(apelido) > 60:
        erros["apelido"] = "Use no máximo 60 caracteres."
    limpo["apelido"] = apelido[:60]

    nivel = _texto(dados, "nivel", 40)
    if nivel not in catalogos.valores(catalogos.NIVEIS):
        erros["nivel"] = "Escolha em que fase dos estudos você está."
    limpo["nivel"] = nivel

    area = _texto(dados, "area_interesse", 40)
    if area and area not in catalogos.valores(catalogos.AREAS):
        erros["area_interesse"] = "Escolha uma área da lista."
    limpo["area_interesse"] = area or None

    limpo["data_nascimento"] = None
    nascimento = _texto(dados, "data_nascimento", 10)
    if nascimento:
        try:
            limpo["data_nascimento"] = date.fromisoformat(nascimento)
        except ValueError:
            erros["data_nascimento"] = "Use uma data válida, como 15/03/2008."
        else:
            hoje = date.today()
            idade = hoje.year - limpo["data_nascimento"].year - (
                (hoje.month, hoje.day) < (limpo["data_nascimento"].month, limpo["data_nascimento"].day)
            )
            if limpo["data_nascimento"] > hoje:
                erros["data_nascimento"] = "A data de nascimento não pode ser no futuro."
            elif idade > 110:
                erros["data_nascimento"] = "Confira o ano: essa data dá mais de 110 anos."

    estado = _texto(dados, "estado", 2).upper()
    if estado and estado not in catalogos.valores(catalogos.ESTADOS):
        erros["estado"] = "Escolha um estado da lista."
    limpo["estado"] = estado or None
    limpo["cidade"] = _texto(dados, "cidade", 120) or None

    # Ensino médio: só a escola, sem curso. Nos outros níveis, até 4 graduações (curso + instituição).
    if nivel == "ensino_medio":
        limpo["formacoes"] = []
        limpo["instituicao"] = _texto(dados, "instituicao", 160) or None
        limpo["curso"] = None
    else:
        formacoes = []
        for item in (dados.get("formacoes") or [])[:4]:
            if not isinstance(item, dict):
                continue
            curso = _texto(item, "curso", 120)
            instituicao = _texto(item, "instituicao", 160)
            if curso or instituicao:
                formacoes.append({"curso": curso, "instituicao": instituicao})
        limpo["formacoes"] = formacoes
        limpo["instituicao"] = (formacoes[0]["instituicao"] or None) if formacoes else None
        limpo["curso"] = (formacoes[0]["curso"] or None) if formacoes else None

    identidades = {}
    validas = catalogos.valores(catalogos.IDENTIDADES)
    for item in dados.get("identidades") or []:
        if isinstance(item, dict) and item.get("valor") in validas:
            identidades[item["valor"]] = bool(item.get("publica"))
    limpo["identidades"] = identidades

    limpo["foto"] = "manter"
    foto_id = dados.get("foto_id")
    if foto_id:
        foto = db.session.get(Arquivo, foto_id) if isinstance(foto_id, int) else None
        if not foto or foto.usuaria_id != usuaria.id or foto.tipo != "imagem" or foto.projeto_id:
            erros["foto"] = "Não achamos essa foto. Escolha a imagem de novo."
        else:
            limpo["foto"] = foto.url
    elif dados.get("remover_foto"):
        limpo["foto"] = None  # volta para a foto do Google, se houver

    # A biografia só existe na edição do perfil; o cadastro inicial não manda o campo.
    if "bio" in dados:
        limpo["bio"] = _texto(dados, "bio", 501)
        if len(limpo["bio"]) > 500:
            erros["bio"] = "Use no máximo 500 caracteres."

    return limpo, erros


@bp.post("/api/perfil")
def api_salvar_perfil():
    usuaria = _usuaria_logada()
    if not usuaria:
        return _erro("Sua sessão terminou. Entre com Google de novo para salvar.", 401)

    limpo, erros = _validar_perfil(request.get_json(silent=True) or {}, usuaria)
    if erros:
        return _erro("Confira os campos marcados.", 422, erros=erros)

    for campo in ("apelido", "nivel", "area_interesse", "instituicao", "curso", "cidade"):
        setattr(usuaria, campo, limpo[campo])
    if "bio" in limpo:
        usuaria.bio = limpo["bio"] or None

    atuais = {i.identidade: i for i in usuaria.identidades}
    for valor, identidade in atuais.items():
        if valor not in limpo["identidades"]:
            usuaria.identidades.remove(identidade)
    for valor, publica in limpo["identidades"].items():
        if valor in atuais:
            atuais[valor].publica = publica
        else:
            usuaria.identidades.append(IdentidadeUsuaria(identidade=valor, publica=publica))

    conta = usuaria.conta or ContaUsuaria(usuaria_id=usuaria.id)
    conta.data_nascimento = limpo["data_nascimento"]
    conta.estado = limpo["estado"]
    conta.formacoes = limpo["formacoes"]
    if limpo["foto"] != "manter":
        conta.foto_url = limpo["foto"]
    conta.cadastro_concluido_em = conta.cadastro_concluido_em or datetime.utcnow()
    db.session.add(conta)
    db.session.commit()

    return jsonify({"perfil": _perfil_json(usuaria), "proximo": url_for("conta.landing")})
