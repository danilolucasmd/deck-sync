RCLONE_VERSION := 1.76.0
RCLONE_SHA256 := b00f00b3266c3764413afe599d3ec316f6f43b3e0ea8a0bc1d186d2133e46df7
RCLONE_ARCHIVE := rclone-v$(RCLONE_VERSION)-linux-amd64

.PHONY: all clean
all: out/rclone

$(RCLONE_ARCHIVE).zip:
	wget -q https://downloads.rclone.org/v$(RCLONE_VERSION)/$@
	echo "$(RCLONE_SHA256)  $@" | sha256sum -c -

out/rclone: $(RCLONE_ARCHIVE).zip
	unzip -oq $< $(RCLONE_ARCHIVE)/rclone
	mkdir -p out
	install -m 755 $(RCLONE_ARCHIVE)/rclone $@

clean:
	rm -rf out $(RCLONE_ARCHIVE) $(RCLONE_ARCHIVE).zip
