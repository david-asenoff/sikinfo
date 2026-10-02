// Строи двойките Word + Excel за циркулярен печат (Mail Merge) за един избор.
//
// За всяко приложение (31-ПВР, 32-ПВР, 33-ПВР):
//   <избор>/NN-PVR.docx         образецът на ЦИК с полета за сливане на мястото на точките
//   <избор>/NN-PVR.xlsx         празна таблица с колоните, които документът очаква
//   <избор>/primer/NN-PVR.xlsx  същата таблица с измислени редове за проба
//   <избор>.zip                 цялата папка като един файл, за изтегляне от сайта
//
// Word документите се правят от оригиналите в <избор>/originali/: текстът и
// форматирането на ЦИК не се пипат, сменят се само многоточията с полета.
// Excel файловете се пишат директно като XML в ZIP, без външни библиотеки.
//
// Използване (от главната папка на репото):
//   dotnet run --project src/SikInfo.Tools -- 2026-10-25-PVR

using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;

var election = args.Length > 0 ? args[0] : "2026-10-25-PVR";
var repoRoot = FindRepoRoot();
var electionDir = Path.Combine(repoRoot, election);
if (!Directory.Exists(Path.Combine(electionDir, "originali")))
{
    Console.Error.WriteLine($"Няма папка {electionDir}\\originali с оригиналите на ЦИК.");
    return 1;
}

Directory.CreateDirectory(Path.Combine(electionDir, "primer"));
foreach (var n in new[] { "31", "32", "33" })
{
    var source = Path.Combine(electionDir, "originali", $"prilojenie-{n}-PVR.docx");
    var docx = Path.Combine(electionDir, $"{n}-PVR.docx");
    var fields = Docx.Build(n, source, docx);
    var headers = Columns.For(n).Select(c => c.Header).ToList();
    var unknown = fields.Where(f => !headers.Contains(f)).ToList();
    if (unknown.Count > 0)
    {
        Console.Error.WriteLine($"{docx}: полета без колона в Excel: {string.Join(", ", unknown)}");
        return 1;
    }
    Xlsx.Write(Path.Combine(electionDir, $"{n}-PVR.xlsx"), Columns.For(n), new List<object?[]>());
    Xlsx.Write(Path.Combine(electionDir, "primer", $"{n}-PVR.xlsx"), Columns.For(n), Examples.Rows(n));
    Console.WriteLine($"{n}-PVR: {fields.Count} полета, {headers.Count} колони");
}

var zipCount = ElectionZip.Build(repoRoot, election);
Console.WriteLine($"{election}.zip: {zipCount} файла");
return 0;

static string FindRepoRoot()
{
    // главната папка на репото: тази, в която има папка src
    var dir = new DirectoryInfo(Directory.GetCurrentDirectory());
    while (dir != null && !Directory.Exists(Path.Combine(dir.FullName, "src")))
        dir = dir.Parent;
    return dir?.FullName ?? Directory.GetCurrentDirectory();
}

// ------------------------------------------------------------------ колони
enum Kind { Text, Date, List, General }

record Column(string Header, int Width, Kind Kind);

static class Columns
{
    static readonly Column[] Common =
    [
        new("Три_имена", 34, Kind.Text),
        new("ЕГН", 14, Kind.Text),
        new("Позиция", 20, Kind.List),
        new("Номер_секция", 16, Kind.Text),
    ];
    static readonly Column[] Inland =
    [
        new("Населено_място", 20, Kind.Text),
        new("Кметство", 18, Kind.Text),
        new("Адм_район", 22, Kind.Text),
        new("Община", 18, Kind.Text),
        new("Район_номер", 13, Kind.Text),
        new("Район_наименование", 24, Kind.Text),
    ];
    static readonly Column[] Abroad =
    [
        new("Държава", 20, Kind.Text),
        new("Място", 22, Kind.Text),
    ];
    static readonly Column[] Tail =
    [
        new("Решение_номер", 15, Kind.General),
        new("Дата_решение", 16, Kind.Date),
        new("Удостоверение_номер", 20, Kind.General),
        new("Дата_издаване", 16, Kind.Date),
    ];

    public static Column[] For(string n) => n == "31"
        ? [.. Common, .. Abroad, .. Tail]
        : [.. Common, .. Inland, .. Tail];
}

// ------------------------------------------------------------ Word: полета
// Част от абзац: обикновен текст или поле за сливане (с ключ за форматиране).
record Part(string Text, bool IsField = false, string Switch = "");

static class Docx
{
    const string DateSwitch = "\\@ \"dd.MM.yyyy\"";   // истинска Excel дата -> 01.09.2026
    const string EgnSwitch = "\\# \"0000000000\"";    // допълва водещата нула на ЕГН

    static Part T(string text) => new(text);
    static Part F(string name, string sw = "") => new(name, true, sw);

    const string ElectionText = "за изборите за президент и вицепрезидент на републиката на 25 октомври 2026 г.";

    static readonly Part[] DocNo = [T("№ "), F("Удостоверение_номер"), T("/"), F("Дата_издаване", DateSwitch), T(" г.")];
    static readonly Part[] CertRik =
    [
        T("Районната избирателна комисия удостоверява, че с Решение № "), F("Решение_номер"),
        T(" от "), F("Дата_решение", DateSwitch), T(" г. "), F("Три_имена"), T(", ЕГН "), F("ЕГН", EgnSwitch), T(","),
    ];
    static readonly Part[] CertCik =
    [
        T("Централната избирателна комисия удостоверява, че с Решение № "), F("Решение_номер"),
        T(" от "), F("Дата_решение", DateSwitch), T(" г. "), F("Три_имена"), T(", ЕГН "), F("ЕГН", EgnSwitch), T(","),
    ];
    static readonly Part[] Location =
    [
        T("населено място "), F("Населено_място"), T(", кметство "), F("Кметство"),
        T(", административен район "), F("Адм_район"), T(", община "), F("Община"),
    ];

    // За всеки абзац: регулярен израз върху текста му -> ново съдържание.
    static readonly Dictionary<string, (string Pattern, Part[] Parts)[]> Paragraphs = new()
    {
        ["33"] =
        [
            ("^РАЙОН №", [T("РАЙОН № "), F("Район_номер"), T(" – "), F("Район_наименование")]),
            ("^№\\s*\\.{3,}", DocNo),
            ("^Районната избирателна комисия удостоверява", CertRik),
            ("^е назначен/а за", [T("е назначен/а за "), F("Позиция")]),
            ("^на секционната избирателна комисия в секция/ПСИК №",
                [T("на секционната избирателна комисия в секция/ПСИК № "), F("Номер_секция"), T(",")]),
            ("^населено място",
                [.. Location, T(", район № "), F("Район_номер"), T(" – "), F("Район_наименование"), T(", " + ElectionText)]),
        ],
        ["32"] =
        [
            ("^№\\s*\\.{3,}", DocNo),
            ("^Централната избирателна комисия удостоверява", CertCik),
            ("^е назначен\\(а\\) за", [T("е назначен(а) за "), F("Позиция")]),
            ("^на секционна избирателна комисия в секция №",
                [T("на секционна избирателна комисия в секция № "), F("Номер_секция"), T(", "), .. Location,
                 T(", в район № "), F("Район_номер"), T(" – "), F("Район_наименование"), T(", " + ElectionText)]),
        ],
        ["31"] =
        [
            ("^№\\s*\\.{3,}", DocNo),
            // в 31-ПВР изречението е разделено на два абзаца в оригинала
            ("^Централната избирателна комисия удостоверява",
                [T("Централната избирателна комисия удостоверява, че с Решение № "), F("Решение_номер"),
                 T(" от "), F("Дата_решение", DateSwitch), T(" г.")]),
            ("^…+.*ЕГН", [F("Три_имена"), T(", ЕГН "), F("ЕГН", EgnSwitch), T(",")]),
            ("^е назначен/а за", [T("е назначен/а за "), F("Позиция")]),
            ("^на секционната избирателна комисия в секция\\s+№",
                [T("на секционната избирателна комисия в секция № "), F("Номер_секция"), T(",")]),
            ("^държава", [T("държава "), F("Държава"), T(", място "), F("Място"), T(",")]),
        ],
    };

    static readonly Regex ParagraphRx = new(@"<w:p\b[^>]*>.*?</w:p>", RegexOptions.Singleline);
    static readonly Regex TextRx = new(@"<w:t(?:\s[^>]*)?>(.*?)</w:t>", RegexOptions.Singleline);
    static readonly Regex OpenCloseRx = new(@"^(<w:p\b[^>]*>)(.*)(</w:p>)$", RegexOptions.Singleline);
    static readonly Regex PPrRx = new(@"^\s*<w:pPr>.*?</w:pPr>", RegexOptions.Singleline);
    static readonly Regex RPrRx = new(@"<w:r\b[^>]*>\s*(<w:rPr>.*?</w:rPr>)", RegexOptions.Singleline);

    public static List<string> Build(string n, string source, string destination)
    {
        string document;
        var entries = new List<(string Name, byte[] Data)>();
        using (var zin = ZipFile.OpenRead(source))
        {
            foreach (var entry in zin.Entries)
            {
                using var stream = entry.Open();
                using var ms = new MemoryStream();
                stream.CopyTo(ms);
                entries.Add((entry.FullName, ms.ToArray()));
            }
        }
        var docIndex = entries.FindIndex(e => e.Name == "word/document.xml");
        document = Encoding.UTF8.GetString(entries[docIndex].Data);

        var specs = Paragraphs[n];
        var used = new bool[specs.Length];
        document = ParagraphRx.Replace(document, m =>
        {
            var text = ParagraphText(m.Value);
            for (var i = 0; i < specs.Length; i++)
            {
                if (!used[i] && Regex.IsMatch(text, specs[i].Pattern))
                {
                    used[i] = true;
                    return Rebuild(m.Value, specs[i].Parts, justify: text.Contains("удостоверява"));
                }
            }
            return m.Value;
        });
        var missing = specs.Where((s, i) => !used[i]).Select(s => s.Pattern).ToList();
        if (missing.Count > 0)
            throw new InvalidOperationException($"{source}: не бяха намерени абзаци за: {string.Join(", ", missing)}");

        entries[docIndex] = ("word/document.xml", Encoding.UTF8.GetBytes(document));
        using (var zout = new ZipArchive(File.Create(destination), ZipArchiveMode.Create))
        {
            foreach (var (name, data) in entries)
            {
                var e = zout.CreateEntry(name, CompressionLevel.Optimal);
                using var s = e.Open();
                s.Write(data);
            }
        }
        return specs.SelectMany(s => s.Parts).Where(p => p.IsField).Select(p => p.Text).Distinct().Order().ToList();
    }

    static string ParagraphText(string paragraph) =>
        string.Concat(TextRx.Matches(paragraph).Select(m => Regex.Replace(m.Groups[1].Value, "<[^>]+>", "")));

    static string Rebuild(string paragraph, Part[] parts, bool justify)
    {
        var m = OpenCloseRx.Match(paragraph);
        var openTag = m.Groups[1].Value;
        var inner = m.Groups[2].Value;
        var closeTag = m.Groups[3].Value;
        var pprMatch = PPrRx.Match(inner);
        var ppr = pprMatch.Success ? pprMatch.Value : "";
        var rest = inner[ppr.Length..];
        var rprMatch = RPrRx.Match(rest);
        var rpr = rprMatch.Success ? rprMatch.Groups[1].Value : "";
        // Изречението „удостоверява, че…“ в 33-ПВР е центрирано в оригинала (с многоточия);
        // попълнено се подравнява двустранно, както е в 31 и 32. Останалото не се пипа.
        if (justify)
            ppr = ppr.Replace("<w:jc w:val=\"center\"/>", "<w:jc w:val=\"both\"/>");
        var runs = new StringBuilder();
        foreach (var part in parts)
            runs.Append(part.IsField ? FieldRuns(part.Text, part.Switch, rpr) : TextRun(part.Text, rpr));
        return openTag + ppr + runs + closeTag;
    }

    static string Esc(string s) => s.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;");

    static string TextRun(string text, string rpr) =>
        $"<w:r>{rpr}<w:t xml:space=\"preserve\">{Esc(text)}</w:t></w:r>";

    static string FieldRuns(string name, string sw, string rpr)
    {
        var instr = sw.Length > 0 ? $" MERGEFIELD {name} {sw} " : $" MERGEFIELD {name} ";
        return $"<w:r>{rpr}<w:fldChar w:fldCharType=\"begin\"/></w:r>" +
               $"<w:r>{rpr}<w:instrText xml:space=\"preserve\">{Esc(instr)}</w:instrText></w:r>" +
               $"<w:r>{rpr}<w:fldChar w:fldCharType=\"separate\"/></w:r>" +
               TextRun($"«{name}»", rpr) +
               $"<w:r>{rpr}<w:fldChar w:fldCharType=\"end\"/></w:r>";
    }
}

// ------------------------------------------------------------- Excel файл
static class Xlsx
{
    const string ContentTypes =
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
        "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">" +
        "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>" +
        "<Default Extension=\"xml\" ContentType=\"application/xml\"/>" +
        "<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>" +
        "<Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>" +
        "<Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>" +
        "</Types>";
    const string Rels =
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
        "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
        "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>" +
        "</Relationships>";
    const string Workbook =
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
        "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" " +
        "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">" +
        "<sheets><sheet name=\"Членове\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>";
    const string WorkbookRels =
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
        "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
        "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/>" +
        "<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>" +
        "</Relationships>";
    // стилове: 0 обикновен, 1 заглавие, 2 текст (@), 3 дата, 4 общ формат
    const string Styles =
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
        "<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">" +
        "<numFmts count=\"1\"><numFmt numFmtId=\"164\" formatCode=\"dd.mm.yyyy\"/></numFmts>" +
        "<fonts count=\"2\">" +
        "<font><sz val=\"10\"/><name val=\"Arial\"/></font>" +
        "<font><b/><sz val=\"10\"/><color rgb=\"FFFFFFFF\"/><name val=\"Arial\"/></font>" +
        "</fonts>" +
        "<fills count=\"3\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill>" +
        "<fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF1B5E9E\"/></patternFill></fill></fills>" +
        "<borders count=\"2\"><border><left/><right/><top/><bottom/><diagonal/></border>" +
        "<border><left style=\"thin\"><color rgb=\"FFC8CDD3\"/></left><right style=\"thin\"><color rgb=\"FFC8CDD3\"/></right>" +
        "<top style=\"thin\"><color rgb=\"FFC8CDD3\"/></top><bottom style=\"thin\"><color rgb=\"FFC8CDD3\"/></bottom><diagonal/></border></borders>" +
        "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>" +
        "<cellXfs count=\"5\">" +
        "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>" +
        "<xf numFmtId=\"0\" fontId=\"1\" fillId=\"2\" borderId=\"1\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\" applyAlignment=\"1\">" +
        "<alignment horizontal=\"center\" vertical=\"center\" wrapText=\"1\"/></xf>" +
        "<xf numFmtId=\"49\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/>" +
        "<xf numFmtId=\"164\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/>" +
        "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>" +
        "</cellXfs>" +
        "<cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles>" +
        "</styleSheet>";

    const string Positions = "председател,зам.-председател,секретар,член";
    const int LastRow = 1000;

    static int StyleOf(Kind kind) => kind switch
    {
        Kind.Text => 2,
        Kind.List => 2,
        Kind.Date => 3,
        _ => 4,
    };

    static string ColLetter(int i)
    {
        var s = "";
        while (i > 0)
        {
            i--;
            s = (char)('A' + i % 26) + s;
            i /= 26;
        }
        return s;
    }

    static int ExcelSerial(DateOnly d) => d.DayNumber - new DateOnly(1899, 12, 30).DayNumber;

    static string Esc(string s) => s.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;");

    static string Cell(string reference, object? value, int style) => value switch
    {
        null or "" => $"<c r=\"{reference}\" s=\"{style}\"/>",
        DateOnly d => $"<c r=\"{reference}\" s=\"{style}\"><v>{ExcelSerial(d)}</v></c>",
        int i => $"<c r=\"{reference}\" s=\"{style}\"><v>{i}</v></c>",
        _ => $"<c r=\"{reference}\" s=\"{style}\" t=\"inlineStr\"><is><t xml:space=\"preserve\">{Esc(value.ToString()!)}</t></is></c>",
    };

    public static void Write(string path, Column[] columns, List<object?[]> rows)
    {
        var cols = new StringBuilder();
        for (var i = 0; i < columns.Length; i++)
            cols.Append($"<col min=\"{i + 1}\" max=\"{i + 1}\" width=\"{columns[i].Width}\" style=\"{StyleOf(columns[i].Kind)}\" customWidth=\"1\"/>");

        var data = new StringBuilder("<row r=\"1\" ht=\"30\" customHeight=\"1\">");
        for (var i = 0; i < columns.Length; i++)
            data.Append(Cell($"{ColLetter(i + 1)}1", columns[i].Header, 1));
        data.Append("</row>");
        for (var r = 0; r < rows.Count; r++)
        {
            data.Append($"<row r=\"{r + 2}\">");
            for (var i = 0; i < columns.Length; i++)
                data.Append(Cell($"{ColLetter(i + 1)}{r + 2}", rows[r][i], StyleOf(columns[i].Kind)));
            data.Append("</row>");
        }

        var listCols = columns.Select((c, i) => (c, i)).Where(x => x.c.Kind == Kind.List).Select(x => ColLetter(x.i + 1)).ToList();
        var validations = string.Concat(listCols.Select(c =>
            $"<dataValidation type=\"list\" allowBlank=\"1\" showErrorMessage=\"1\" " +
            $"errorTitle=\"Непозната длъжност\" error=\"Изберете от списъка: {Positions}.\" sqref=\"{c}2:{c}{LastRow}\">" +
            $"<formula1>\"{Positions}\"</formula1></dataValidation>"));

        var sheet =
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
            "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">" +
            $"<dimension ref=\"A1:{ColLetter(columns.Length)}{Math.Max(1, rows.Count + 1)}\"/>" +
            "<sheetViews><sheetView workbookViewId=\"0\"><pane ySplit=\"1\" topLeftCell=\"A2\" " +
            "activePane=\"bottomLeft\" state=\"frozen\"/></sheetView></sheetViews>" +
            "<sheetFormatPr defaultRowHeight=\"15\"/>" +
            $"<cols>{cols}</cols><sheetData>{data}</sheetData>" +
            (listCols.Count > 0 ? $"<dataValidations count=\"{listCols.Count}\">{validations}</dataValidations>" : "") +
            "<pageMargins left=\"0.7\" right=\"0.7\" top=\"0.75\" bottom=\"0.75\" header=\"0.3\" footer=\"0.3\"/>" +
            "</worksheet>";

        using var zip = new ZipArchive(File.Create(path), ZipArchiveMode.Create);
        Add(zip, "[Content_Types].xml", ContentTypes);
        Add(zip, "_rels/.rels", Rels);
        Add(zip, "xl/workbook.xml", Workbook);
        Add(zip, "xl/_rels/workbook.xml.rels", WorkbookRels);
        Add(zip, "xl/styles.xml", Styles);
        Add(zip, "xl/worksheets/sheet1.xml", sheet);
    }

    static void Add(ZipArchive zip, string name, string content)
    {
        var entry = zip.CreateEntry(name, CompressionLevel.Optimal);
        using var s = entry.Open();
        s.Write(Encoding.UTF8.GetBytes(content));
    }
}

// ------------------------------------------------------------ примерни данни
static class Examples
{
    static readonly int[] EgnWeights = [2, 4, 8, 5, 10, 9, 7, 3, 6];

    // Измислено, но математически валидно ЕГН - само за примерните файлове.
    static string MakeEgn(int y, int m, int d, int idx)
    {
        var baseDigits = $"{y % 100:00}{m:00}{d:00}{idx:000}";
        var sum = 0;
        for (var i = 0; i < 9; i++) sum += (baseDigits[i] - '0') * EgnWeights[i];
        var check = sum % 11;
        return baseDigits + (check == 10 ? 0 : check);
    }

    static readonly string[] Names =
    [
        "Иван Петров Георгиев", "Мария Стоянова Димитрова", "Георги Иванов Колев",
        "Елена Николова Тодорова", "Димитър Асенов Петков", "Светла Христова Ангелова",
        "Николай Стефанов Маринов", "Виолета Кирилова Вълчева", "Петър Богомилов Илиев",
    ];
    static readonly string[] Positions = ["председател", "зам.-председател", "секретар", "член", "член"];
    static readonly string[] Districts = ["Одесос", "Приморски", "Младост", "Владислав Варненчик", "Аспарухово"];
    static readonly DateOnly Decision = new(2026, 9, 1);

    static object?[] Tail(int i) => [48, Decision, i, Decision];

    public static List<object?[]> Rows(string n)
    {
        if (n == "33")
            return Enumerable.Range(0, 9).Select(i => (object?[])
            [
                Names[i], MakeEgn(1975 + i, i % 12 + 1, i % 28 + 1, 100 + i), Positions[i % 5],
                $"3060{1 + i % 5}00{1 + i}", "гр. Варна", "", Districts[i % 5], "Варна", "03", "Варна",
                .. Tail(i + 1),
            ]).ToList();
        if (n == "32")
            return
            [
                ["Радостина Митева Панайотова", MakeEgn(1980, 5, 12, 210), "член", "30601010",
                 "гр. Варна", "", "Одесос", "Варна", "03", "Варна", .. Tail(10)],
            ];
        return
        [
            ["Стоян Величков Райков", MakeEgn(1986, 3, 7, 300), "председател", "1001", "Германия", "Берлин", .. Tail(11)],
            ["Анна Людмилова Славова", MakeEgn(1987, 3, 8, 301), "секретар", "1002", "Обединено кралство", "Лондон", .. Tail(12)],
        ];
    }
}

// ------------------------------------------------------------------- ZIP
static class ElectionZip
{
    // Цялата папка на избора като един ZIP до нея - за изтегляне от сайта.
    public static int Build(string repoRoot, string election)
    {
        var dir = Path.Combine(repoRoot, election);
        var output = Path.Combine(repoRoot, election + ".zip");
        File.Delete(output);
        using var zip = new ZipArchive(File.Create(output), ZipArchiveMode.Create);
        var count = 0;
        foreach (var file in Directory.EnumerateFiles(dir, "*", SearchOption.AllDirectories).Order())
        {
            var name = Path.GetFileName(file);
            if (name.StartsWith("~$") || name.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)) continue;
            var entryName = election + "/" + Path.GetRelativePath(dir, file).Replace('\\', '/');
            zip.CreateEntryFromFile(file, entryName, CompressionLevel.Optimal);
            count++;
        }
        return count;
    }
}
