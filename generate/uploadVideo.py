import os
import sys
import shutil
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# Replace with your path to the credentials JSON file
CLIENT_SECRETS_FILE = "/home/leapfrog/.client_secrets.json"

# Define the scopes for the API request
SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


def get_authenticated_service():
    creds = None
    # The file token.json stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first
    # time.
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                CLIENT_SECRETS_FILE, SCOPES
            )
            creds = flow.run_local_server(port=0)
        # Save the credentials for the next run
        with open("token.json", "w") as token:
            token.write(creds.to_json())

    return build("youtube", "v3", credentials=creds)


def upload_video(youtube, video_file, title):
    request_body = {
        "snippet": {
            "title": title,
        },
        "status": {
            "privacyStatus": "private",  # Change to "private" for draft status
        },
        "contentDetails": {
            "selfDeclaredMadeForKids": False,
        },
    }

    media = MediaFileUpload(video_file)

    response = (
        youtube.videos()
        .insert(part="snippet,status,contentDetails", body=request_body, media_body=media)
        .execute()
    )

    print(f"Video id \'{response['id']}\' was successfully uploaded.")


OUT_DIR = "/home/leapfrog/projects/personal/video-generator/generate/out/"

if __name__ == "__main__":
    youtube = get_authenticated_service()

    dirs = os.listdir(OUT_DIR)

    videos = list(filter(lambda x: x.endswith(".mp4"), dirs))

    print(list(videos))

    # Replace these variables with your video file path, title, and description

    for video in videos:
        video_file_path = f"{OUT_DIR}/{video}"
        video_title = video.replace("_", " ").split(".mp4")[0]

        print(video_title)
        # upload_video(youtube, video_file_path, video_title)

        # shutil.move(f"{OUT_DIR}/{video}", f"{OUT_DIR}/uploaded/")
