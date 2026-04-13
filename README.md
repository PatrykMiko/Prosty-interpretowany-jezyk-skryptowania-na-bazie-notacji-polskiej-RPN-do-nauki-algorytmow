# Projekt: Tur-ANTLR - język algorytmiczny (RPN/prefix)

## Dane projektu

- **Nazwa języka:** Tur-ANTLR
- **Typ projektu:** interpreter CLI
- **Parser:** ANTLR4 (antlr4ts)
- **Implementacja:** TypeScript + Bun

## Założenia programu

### Opis
Tur-ANTLR to tekstowy język algorytmiczny oparty o składnię prefix (RPN-like): komenda stoi na początku, argumenty po niej.  
Język wspiera pętle, warunki, funkcje i struktury danych używane w klasycznych zadaniach algorytmicznych.

### Cele
- Czytelne zapisywanie algorytmów bez składni C/JS.
- Dynamiczny system typów.
- Obsługa własnych funkcji i rekurencji.
- Praca na strukturach: stos, kolejka, tablica, słownik.
- Wejście od użytkownika przez `read`.
- Jawny model typów + wartość `error`.
- Rozszerzalność przez moduły TypeScript (własne funkcje i typy obiektowe).

### Rodzaj translatora
Interpreter wykonujący AST programu bezpośrednio (brak etapu generacji kodu docelowego).

## Konwencja składni

- **Komendy bez `$`**: `set`, `add`, `while`, `fn`, ...
- **Zmienne z `$`**: `$x`, `$i`, `$arr`
- Program jest liniowy; bloki zamykane są `}`.

Przykład:

```txt
set $x 10
set $y add $x 5
println "y =" $y
```

## Opis tokenów

| Token | Wzorzec | Opis |
|---|---|---|
| `VAR` | `\$[a-zA-Z_][a-zA-Z_0-9]*` | referencja zmiennej |
| `IDENT` | `[a-zA-Z_][a-zA-Z_0-9]*` | nazwa komendy / identyfikator |
| `NUMBER` | `-?[0-9]+(\\.[0-9]+)?` | liczba |
| `STRING` | `"..."` | napis |
| `LBRACE` / `RBRACE` | `{` / `}` | granice bloku |
| `NEWLINE` | `\n` | koniec instrukcji |
| `COMMENT` | `;...` | komentarz linii |

## Gramatyka

Pełna gramatyka znajduje się w:

- `grammar/TurLang.g4`

## Zestaw komend

- Arytmetyka: `add sub mul div mod neg`
- Porównania/logika: `eq neq lt le gt ge and or not`
- Zmienne i sterowanie: `set while if else fn call return`
- Typy i błędy: `type error iserror errmsg`
- I/O i konwersje: `print println read int float bigint str bool len`
- Struktury: `stack queue array dict`
- Rozszerzenia TS: `extcall invoke`
- Operacje struktur:
  - `push pop peek`
  - `enqueue dequeue`
  - `aget aset ainsert aremove`
  - `dset dget dhas ddelete keys values`
  - `size isempty`

## Uruchamianie

#### Instalacja zależności:
```md
Zainstaluj Bun:
https://bun.sh/
```

```bash
cd tur-antlr
bun install
bun run generate
```

Uruchomienie programu:

```bash
bun run run examples/factorial.tur
```

Uruchomienie programu z rozszerzeniem TS:

```bash
bun run run --ext extensions/math-geo.ts examples/types-errors-extensions.tur
```

## Model typów

Wbudowane typy runtime:

- `number`
- `string`
- `bool`
- `bigint`
- `null`
- `stack`, `queue`, `array`, `dict`
- `error`
- `object:<TypeName>` (typy obiektowe z rozszerzeń)

Typy można sprawdzać komendą `type`, np. `type $x`.

### Obsługa błędów (styl Go)

Funkcja/komenda może zwracać wartość `error` zamiast przerywać programu.

Przykład:

```txt
set $r extcall safe_div 2 10 0
if iserror $r {
  println "error:" errmsg $r
} else {
  println "ok:" $r
}
```

## Rozszerzenia TypeScript

Runtime można rozszerzyć przez moduł TS podany flagą `--ext`.

Moduł eksportuje:

```ts
export default {
  functions: {
    "name": (args, api) => { ... }
  }
}
```

`args` to wartości języka, a `api` udostępnia:

- `api.error(message)` -> tworzy wartość `error`
- `api.makeObject(typeName, fields, methods)` -> tworzy typ obiektowy
- `api.typeOf(value)` -> zwraca nazwę typu runtime

Wartości zwracane przez funkcje rozszerzeń muszą być typami języka.
W obiekcie z rozszerzenia pola muszą być typami języka, a metody muszą wskazywać funkcje, które również zwracają typy języka.
Jeśli funkcja rozszerzenia rzuci wyjątek, runtime automatycznie zamieni go na wartość `error`.

### Dekoratory

W `extensions/decorators.ts` jest dekorator `@turSafe`, który owija funkcję rozszerzenia w `try/catch`
i zamienia wyjątek na `api.error(...)`.

## Przykłady algorytmów

- `examples/factorial.tur` - silnia rekurencyjna
- `examples/fibonacci.tur` - Fibonacci iteracyjny
- `examples/structures-demo.tur` - bubble sort + stack/queue/dict
- `examples/input-factorial-iterative.tur` - silnia iteracyjna z wejściem
- `examples/stack-reverse-input.tur` - odwracanie sekwencji przez stos
- `examples/queue-josephus.tur` - problem Josephusa na kolejce
- `examples/types-errors-extensions.tur` - typy, `error`, `iserror`, oraz typ własny z rozszerzenia TS
