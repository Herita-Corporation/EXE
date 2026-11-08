using System.Diagnostics;
using System.Globalization;
using System.Text.Json;

namespace Task.Presentation;

public static class MissionMediaValidator
{
    public static async System.Threading.Tasks.Task Photo(IFormFile file)
    {
        if (file.Length <= 0 || file.Length > 5_000_000) throw new InvalidOperationException("Ảnh phải nhỏ hơn 5 MB.");
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var header = new byte[12]; await using var stream = file.OpenReadStream(); var count = await stream.ReadAsync(header);
        var valid = (ext is ".jpg" or ".jpeg") && count >= 3 && header[0] == 255 && header[1] == 216 && header[2] == 255
            || ext == ".png" && count >= 8 && header.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })
            || ext == ".webp" && count >= 12 && System.Text.Encoding.ASCII.GetString(header, 0, 4) == "RIFF" && System.Text.Encoding.ASCII.GetString(header, 8, 4) == "WEBP";
        if (!valid) throw new InvalidOperationException("Ảnh không hợp lệ; chỉ nhận JPEG, PNG hoặc WebP.");
    }
    public static async System.Threading.Tasks.Task<double> Duration(IFormFile file, string ffprobePath, CancellationToken cancellation)
    {
        if (file.Length <= 0 || file.Length > 100_000_000) throw new InvalidOperationException("Video phải có dung lượng từ 1 byte đến 100 MB.");
        var temp = Path.Combine(Path.GetTempPath(), "disa-media-" + Guid.NewGuid().ToString("N"));
        try
        {
            await using (var output = File.Create(temp)) await file.CopyToAsync(output, cancellation);
            var start = new ProcessStartInfo(ffprobePath) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
            foreach (var arg in new[] { "-v", "error", "-protocol_whitelist", "file,pipe", "-select_streams", "v:0", "-show_entries", "stream=codec_type,duration:format=duration", "-of", "json", temp }) start.ArgumentList.Add(arg);
            using var process = Process.Start(start) ?? throw new InvalidOperationException("Không thể xác minh video.");
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation); timeout.CancelAfter(TimeSpan.FromSeconds(15));
            var stdout = process.StandardOutput.ReadToEndAsync(timeout.Token);
            var stderr = process.StandardError.ReadToEndAsync(timeout.Token);
            try { await process.WaitForExitAsync(timeout.Token); }
            catch { if (!process.HasExited) process.Kill(true); throw new InvalidOperationException("Không thể đọc video trong thời gian cho phép."); }
            var raw = await stdout; await stderr;
            if (process.ExitCode != 0) throw new InvalidOperationException("Không thể đọc nội dung video.");
            using var json = JsonDocument.Parse(raw);
            if (!json.RootElement.TryGetProperty("streams", out var streams) || streams.GetArrayLength() == 0 || streams[0].GetProperty("codec_type").GetString() != "video")
                throw new InvalidOperationException("File không có luồng hình ảnh video.");
            var text = streams[0].TryGetProperty("duration", out var streamDuration) ? streamDuration.GetString() : json.RootElement.GetProperty("format").GetProperty("duration").GetString();
            if (!double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var duration) || !double.IsFinite(duration) || duration <= 0)
                throw new InvalidOperationException("Nội dung video không hợp lệ.");
            return duration;
        }
        finally { if (File.Exists(temp)) File.Delete(temp); }
    }
}
