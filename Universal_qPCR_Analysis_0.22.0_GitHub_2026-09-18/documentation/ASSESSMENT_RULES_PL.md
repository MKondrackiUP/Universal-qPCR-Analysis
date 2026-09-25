# Universal qPCR Analysis — kompletne reguły oceniania

## 0. Walidacja wejścia

- Obsługiwane są XLSX, CSV i TSV do 5 MB oraz najwyżej 100 000 wierszy na plik.
- Wymagane pola semantyczne to preparat, próbka, Detector/Target, Ct/Cq oraz Qty/Quantity; wiele nagłówków mapujących się do jednego pola jest błędem.
- Wszystkie wiersze jednego pliku i wszystkie punkty czasu muszą dotyczyć jednego wspólnego Detectora/Targetu; wielkość liter nie zmienia zgodności nazwy.
- Ct/Cq, SD i Qty muszą być nieujemnymi liczbami. Puste wartości oraz `NA`, `N/A`, `NaN`, `Undetermined` i `No Ct` są traktowane jako jawne braki.
- Wiersz bez preparatu lub identyfikatora próbki nie jest pomijany po cichu — zatrzymuje import z numerem wiersza.
- Do obliczeń trafiają wyłącznie wiersze `Task=Unknown`; puste Task są ustawiane na `Unknown` i raportowane, a NTC, Standard i inne typy są odrzucane.
- Dopuszczalne braki, Qty równe zero, powtórzone obserwacje, puste Task i nierozpoznane kolumny pozostają w audycie importu interfejsu, projektu i DOCX.

## 1. Populacja i parowanie

- Podstawową jednostką jest sparowany rekord preparat–płeć–próbka w T0 i T1.
- Płeć może być pusta, ale nazwa preparatu i identyfikator próbki są wymagane.
- Powtórzenia tej samej pary w jednym punkcie czasu są uśredniane arytmetycznie i zliczane w audycie.
- Brakujące Ct lub Qty pozostają brakujące; aplikacja nie stosuje imputacji.
- Do oceny kierunku potrzeba co najmniej trzech kompletnych par Qty.

## 2. Główny efekt Qty

Offset Qty jest równy połowie najmniejszej dodatniej wartości Qty we wszystkich analizowanych punktach; jeżeli brak wartości dodatnich, używany jest fallback `0,001`.

Dla każdej kompletnej pary obliczane jest:

`d = log10((Qty_T1 + offset) / (Qty_T0 + offset))`.

Efektem preparatu jest mediana wartości `d`: wartość ujemna oznacza spadek, dodatnia wzrost, a dokładne zero brak zmiany.

Krotność zmiany wynosi `10^mediana(d)`, a zmiana procentowa `(10^mediana(d) − 1) × 100%`.

## 3. Test Wilcoxona

- Hipoteza zerowa mówi, że rozkład sparowanych różnic jest wyśrodkowany na zerze, a test jest dwustronny.
- Różnice równe zero są wyłączane przed rangowaniem.
- Wartości bezwzględne otrzymują rangi rosnące, a remisy rangi średnie.
- Statystyka `W` jest mniejszą z sum rang dodatnich i ujemnych.
- Dla 3–20 niezerowych par p jest obliczane przez dokładną permutację wszystkich znaków.
- Powyżej 20 niezerowych par stosowane jest przybliżenie normalne z korektą remisów i ciągłości.
- Przy mniej niż trzech niezerowych parach W, p i q nie są używane do potwierdzenia wyniku, a raport podaje powód.

## 4. Korekta wielokrotnych porównań

Benjamini–Hochberg jest wykonywany osobno dla każdego punktu końcowego i kontrastu, np. dla wszystkich preparatów Qty w T1 względem T0.

Po uporządkowaniu m poprawnych wartości p rosnąco obliczane jest `p(i) × m / i`, następnie wartości są ograniczane do 1 i monotonicznie korygowane od końca; wynikiem jest q.

Próg statystycznego potwierdzenia wynosi ściśle `q < 0,05`, a nie `q ≤ 0,05`.

## 5. Statystyczna ocena qPCR

Kolejność reguł jest następująca:

1. Mniej niż trzy kompletne pary lub brak efektu daje `insufficient_data`.
2. Mediana równa zero daje `no_detected_change`.
3. Dla celu neutralnego wynik jest wyłącznie `descriptive_decreased` albo `descriptive_increased`.
4. Kierunek zgodny z celem i `q < 0,05` daje `confirmed_supportive`.
5. Kierunek zgodny bez spełnienia progu daje `supportive_signal`.
6. Kierunek przeciwny do celu i `q < 0,05` daje `confirmed_contradictory`.
7. Kierunek przeciwny bez spełnienia progu daje `contradictory_signal`.

Jeżeli liczba spadków i wzrostów jest równa, interfejs i raport prezentują wynik jako kierunek mieszany i niepewny; surowy kierunek mediany pozostaje dostępny wyłącznie opisowo.

## 6. Ct/Cq

Pomocniczy efekt Ct wynosi `Ct_T1 − Ct_T0` i jest testowany tą samą procedurą Wilcoxona oraz FDR, lecz nie zmienia głównej oceny Qty ani nie dostarcza dodatkowych punktów Tier.

## 7. Audyt integralności

Aplikacja wykrywa identyczne wielozbiory Ct/Qty między preparatami i punktami czasu, oznacza je jako wymagające sprawdzenia względem oryginalnego eksportu, ale nie usuwa ich automatycznie.

## 8. Oddzielny moduł Tier

Tier wykorzystuje wersjonowany wynik:

`sygnał qPCR + zdefiniowanie + dowody kontekstowe + mechanizm + gotowość transkryptomiczna − ryzyko`,

przy wagach równych 1 dla każdego składnika i zakresach: zdefiniowanie `0–2`, kontekst `0–2`, mechanizm `−2…1`, gotowość `0–2`, ryzyko `0–3`.

Sygnał qPCR jest efektem zorientowanym na cel, ograniczonym do `−2…2`, pomnożonym przez wiarygodność `0,5 + 0,5 × zgodność kierunku`.

Reguły Tier są stosowane kolejno:

1. Kierunek qPCR przeciwny do celu wymusza Tier 5.
2. Brak profilu dowodów wymusza Tier 4.
3. Zdefiniowanie równe 0 lub gotowość równa 0 wymusza Tier 4.
4. Ujemne dopasowanie mechanistyczne przy kierunku zgodnym ogranicza wynik do Tier 3.
5. Zerowe wsparcie mechanistyczne i kontekstowe przy kierunku zgodnym ogranicza wynik do Tier 3.
6. Kierunek zgodny, wynik co najmniej 4, zdefiniowanie co najmniej 2 i mechanizm co najmniej 1 daje Tier 1.
7. Kierunek zgodny i wynik co najmniej 2,5 daje Tier 2.
8. Wynik co najmniej 2,5 daje Tier 3, a pozostałe przypadki Tier 4.

Profil CSV użytkownika zastępuje cały profil wbudowany i nie jest z nim łączony; brakująca pozycja nie otrzymuje zgadywanych ocen.

Tier oznacza priorytet dalszej walidacji, a nie skuteczność, bezpieczeństwo kliniczne ani rekomendację terapeutyczną.

## 9. Odtwarzalność

Obowiązujące maszynowe definicje znajdują się w `config/qpcr_analysis_specification_v2.json` i `config/universal_tier_specification_v1.json`, a każdy raport zapisuje wersje reguł, W, p, q, metodę, kompletność i regułę rozstrzygającą.
