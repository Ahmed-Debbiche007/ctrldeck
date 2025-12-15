# Windows Media Control Script using WinRT APIs
# This script retrieves media playback information from Windows

try {
    # Load Windows Runtime
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    
    # Load Windows Storage Streams for DataReader
    [Windows.Storage.Streams.DataReader,Windows.Storage.Streams,ContentType=WindowsRuntime] | Out-Null
    
    # Create generic Await function for async operations
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { 
        $_.Name -eq 'AsTask' -and 
        $_.GetParameters().Count -eq 1 -and 
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
    })[0]
    
    Function Await($WinRtTask, $ResultType) {
        $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
        $netTask = $asTask.Invoke($null, @($WinRtTask))
        $netTask.Wait(-1) | Out-Null
        $netTask.Result
    }
    
    # Helper function to convert stream to base64
    function ConvertTo-Base64 {
        param($stream)
        if ($null -eq $stream) { 
            Write-Debug "Stream is null"
            return "" 
        }
        
        try {
            # Get the size of the stream
            $size = $stream.Size
            if ($size -eq 0) {
                Write-Debug "Stream size is 0"
                return ""
            }
            
            # Create a DataReader for the stream
            $reader = [Windows.Storage.Streams.DataReader]::new($stream)
            $bytesAsync = $reader.LoadAsync([uint32]$size)
            $bytesLoaded = Await $bytesAsync ([uint32])
            
            if ($bytesLoaded -gt 0) {
                # Read the bytes from the reader
                $bytes = New-Object byte[] $bytesLoaded
                $reader.ReadBytes($bytes)
                
                # Convert to base64
                $base64 = [System.Convert]::ToBase64String($bytes)
                
                # Clean up
                $reader.Dispose()
                
                Write-Debug "Successfully converted $bytesLoaded bytes to base64"
                return $base64
            } else {
                Write-Debug "No bytes loaded from stream"
                $reader.Dispose()
                return ""
            }
        } catch {
            Write-Debug "Error converting stream to base64: $_"
            return ""
        }
    }
    
    # Load Windows Media Control
    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime] | Out-Null
    
    # Get session manager
    $mgrAsync = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
    $mgr = Await $mgrAsync ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
    
    # Get current session
    $session = $mgr.GetCurrentSession()
    
    if ($session) {
        # Get playback info (synchronous)
        $playback = $session.GetPlaybackInfo()
        $statusCode = [int]$playback.PlaybackStatus
        
        # Convert status code to string
        $status = switch($statusCode) {
            4 { 'Playing' }
            5 { 'Paused' }
            3 { 'Stopped' }
            default { 'Stopped' }
        }
        
        # Initialize default values
        $title = ""
        $artist = ""
        $album = ""
        $thumbnailBase64 = ""
        
        # Try to get media properties
        try {
            $propsAsync = $session.TryGetMediaPropertiesAsync()
            # Use Await with proper type
            $props = Await $propsAsync ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
            
            if ($props) {
                if ($props.Title) { $title = $props.Title }
                if ($props.Artist) { $artist = $props.Artist }
                if ($props.AlbumTitle) { $album = $props.AlbumTitle }
                
                # Try to get thumbnail
                if ($props.Thumbnail) {
                    try {
                        $thumbAsync = $props.Thumbnail.OpenReadAsync()
                        $stream = Await $thumbAsync ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
                        
                        if ($stream) {
                            $thumbnailBase64 = ConvertTo-Base64 $stream
                            $stream.Dispose()
                        }
                    } catch {
                        # Thumbnail fetch failed, use empty string
                    }
                }
            }
        } catch {
            # Properties fetch failed, use default values
        }
        
        # Build result object
        $result = @{
            Title = $title
            Artist = $artist
            Album = $album
            Status = $status
            Thumbnail = $thumbnailBase64
        }
        
        $result | ConvertTo-Json -Compress
    } else {
        '{"Status":"Stopped","Title":"","Artist":"","Album":"","Thumbnail":""}'
    }
} catch {
    '{"Status":"Stopped","Title":"","Artist":"","Album":"","Thumbnail":""}'
}
